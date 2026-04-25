"""
SkillSync — Courses API
========================
GET  /api/courses/              List all courses with enrollment status
GET  /api/courses/<id>          Course detail
POST /api/courses/              Create course (teacher/admin)
POST /api/courses/<id>/enroll   Enroll current user
DELETE /api/courses/<id>/enroll Unenroll current user
"""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from app import db
from app.models import Course, CourseEnrollment
from app.utils.helpers import success, error, get_current_user, teacher_or_admin

courses_bp = Blueprint("courses", __name__)


@courses_bp.route("/", methods=["GET"])
@jwt_required()
def list_courses():
    user    = get_current_user()
    courses = Course.query.order_by(Course.code).all()

    enrolled_ids = {
        e.course_id
        for e in CourseEnrollment.query.filter_by(student_id=user.id).all()
    }

    result = []
    for c in courses:
        d = c.to_dict()
        d["enrolled"]       = c.id in enrolled_ids
        d["student_count"]  = c.enrollments.count()
        result.append(d)

    return success(result)


@courses_bp.route("/<course_id>", methods=["GET"])
@jwt_required()
def get_course(course_id):
    user   = get_current_user()
    course = Course.query.get_or_404(course_id)
    data   = course.to_dict()
    data["student_count"] = course.enrollments.count()
    data["enrolled"] = CourseEnrollment.query.filter_by(
        course_id=course_id, student_id=user.id
    ).first() is not None
    return success(data)


@courses_bp.route("/", methods=["POST"])
@jwt_required()
@teacher_or_admin
def create_course():
    data = request.get_json(silent=True) or {}
    if not data.get("title") or not data.get("code"):
        return error("title and code are required", 400)

    if Course.query.filter_by(code=data["code"].upper().strip()).first():
        return error("Course code already exists", 409)

    user   = get_current_user()
    course = Course(
        code          = data["code"].upper().strip(),
        title         = data["title"].strip(),
        description   = data.get("description", ""),
        credits       = int(data.get("credits", 3)),
        topic_keyword = data.get("topic_keyword", ""),
        instructor_id = user.id,
    )
    db.session.add(course)
    db.session.commit()
    return success(course.to_dict(), "Course created", 201)


@courses_bp.route("/<course_id>/enroll", methods=["POST"])
@jwt_required()
def enroll(course_id):
    user   = get_current_user()
    course = Course.query.get_or_404(course_id)

    existing = CourseEnrollment.query.filter_by(
        course_id=course_id, student_id=user.id
    ).first()
    if existing:
        return error("Already enrolled", 409)

    db.session.add(CourseEnrollment(course_id=course_id, student_id=user.id))
    db.session.commit()
    return success({"course_id": course_id}, "Enrolled successfully")


@courses_bp.route("/<course_id>/enroll", methods=["DELETE"])
@jwt_required()
def unenroll(course_id):
    user = get_current_user()
    enrollment = CourseEnrollment.query.filter_by(
        course_id=course_id, student_id=user.id
    ).first()
    if not enrollment:
        return error("Not enrolled", 404)

    db.session.delete(enrollment)
    db.session.commit()
    return success(None, "Unenrolled successfully")
