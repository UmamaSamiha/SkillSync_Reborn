"""
SkillSync — Course Resources API
===================================
GET    /api/resources/course/<course_id>   List resources for a course
                                            (students must be enrolled)
POST   /api/resources                      Upload a resource (teacher/admin,
                                            must own the course) — link or file
GET    /api/resources/<id>/download        Download a file-backed resource
DELETE /api/resources/<id>                 Remove a resource (uploader or admin)
"""
import os
from flask import Blueprint, request, current_app, send_file
from flask_jwt_extended import jwt_required

from app import db
from app.models import Resource, Course, CourseEnrollment, Role
from app.utils.helpers import (
    success, error, get_current_user, allowed_file, save_upload,
)

resources_bp = Blueprint("resources", __name__)


def _is_enrolled(user_id, course_id):
    return CourseEnrollment.query.filter_by(
        course_id=course_id, student_id=user_id
    ).first() is not None


def _owns_course(user, course):
    return user.role == Role.ADMIN or course.instructor_id == user.id


@resources_bp.route("/course/<course_id>", methods=["GET"])
@jwt_required()
def list_resources(course_id):
    user = get_current_user()
    if not user:
        return error("User not found", 404)

    course = Course.query.get(course_id)
    if not course:
        return error("Course not found", 404)

    if user.role == Role.STUDENT and not _is_enrolled(user.id, course_id):
        return error("You must be enrolled in this course to view its resources", 403)

    resources = (
        Resource.query.filter_by(course_id=course_id)
        .order_by(Resource.created_at.desc())
        .all()
    )
    return success([r.to_dict() for r in resources])


@resources_bp.route("", methods=["POST"], strict_slashes=False)
@jwt_required()
def upload_resource():
    user = get_current_user()
    if not user or user.role not in (Role.TEACHER, Role.ADMIN):
        return error("Teacher or admin access required", 403)

    # Support both JSON (link resources) and multipart form (file uploads)
    is_multipart = request.content_type and "multipart/form-data" in request.content_type
    data = request.form if is_multipart else (request.get_json(silent=True) or {})

    course_id = data.get("course_id")
    title     = (data.get("title") or "").strip()
    if not course_id or not title:
        return error("course_id and title are required", 400)

    course = Course.query.get(course_id)
    if not course:
        return error("Course not found", 404)
    if not _owns_course(user, course):
        return error("You can only add resources to your own courses", 403)

    resource = Resource(
        course_id   = course_id,
        title       = title,
        description = data.get("description", ""),
        created_by  = user.id,
    )

    file = request.files.get("file") if is_multipart else None
    if file and file.filename:
        if not allowed_file(file.filename):
            return error("File type not allowed", 400)
        resource.file_path = save_upload(file, subfolder="resources")
        resource.file_name = file.filename
        resource.type       = data.get("type") or "file"
    else:
        url = (data.get("url") or "").strip()
        if not url:
            return error("Provide either a file or a url", 400)
        resource.url  = url
        resource.type = data.get("type") or "link"

    resource.difficulty = data.get("difficulty", "beginner")

    db.session.add(resource)
    db.session.commit()
    return success(resource.to_dict(), "Resource added", 201)


@resources_bp.route("/<resource_id>/download", methods=["GET"])
@jwt_required()
def download_resource(resource_id):
    user = get_current_user()
    if not user:
        return error("User not found", 404)

    resource = Resource.query.get(resource_id)
    if not resource:
        return error("Resource not found", 404)
    if not resource.file_path:
        return error("This resource has no downloadable file", 400)

    if user.role == Role.STUDENT and resource.course_id and not _is_enrolled(user.id, resource.course_id):
        return error("You must be enrolled in this course to download its resources", 403)

    full_path = os.path.abspath(os.path.join(current_app.config["UPLOAD_FOLDER"], resource.file_path))
    if not os.path.exists(full_path):
        return error("File not found on server", 404)

    return send_file(full_path, as_attachment=True, download_name=resource.file_name or resource.title)


@resources_bp.route("/<resource_id>", methods=["DELETE"])
@jwt_required()
def delete_resource(resource_id):
    user = get_current_user()
    if not user or user.role not in (Role.TEACHER, Role.ADMIN):
        return error("Teacher or admin access required", 403)

    resource = Resource.query.get(resource_id)
    if not resource:
        return error("Resource not found", 404)
    if user.role != Role.ADMIN and resource.created_by != user.id:
        return error("You can only delete resources you uploaded", 403)

    if resource.file_path:
        full_path = os.path.abspath(os.path.join(current_app.config["UPLOAD_FOLDER"], resource.file_path))
        if os.path.exists(full_path):
            os.remove(full_path)

    db.session.delete(resource)
    db.session.commit()
    return success(None, "Resource deleted")
