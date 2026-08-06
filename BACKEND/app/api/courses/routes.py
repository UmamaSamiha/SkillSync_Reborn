"""
SkillSync — Courses API
========================
GET    /api/courses/                 List courses with enrollment status
                                      (active courses, plus the caller's own
                                      pending/deleted ones if they're the instructor)
GET    /api/courses/<id>             Course detail
POST   /api/courses/                 Create course (teacher/admin) — teacher-created
                                      courses start as pending_approval
DELETE /api/courses/<id>             Request removal (teacher) / remove (admin)
GET    /api/courses/pending          List courses awaiting admin approval (admin only)
POST   /api/courses/<id>/approve     Approve a pending course (admin only)
POST   /api/courses/<id>/reject      Reject a pending course (admin only)
POST   /api/courses/<id>/enroll      Enroll current user
DELETE /api/courses/<id>/enroll      Unenroll current user
"""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from sqlalchemy import or_

from app import db
from app.models import (
    Course, CourseStatus, CourseEnrollment, Project, ProjectMember,
    User, Role, Notification,
)
from app.utils.helpers import success, error, get_current_user, teacher_or_admin

courses_bp = Blueprint("courses", __name__)


def _notify_admins(title, message, entity_id=None):
    admins = User.query.filter_by(role=Role.ADMIN, is_active=True).all()
    for admin in admins:
        db.session.add(Notification(
            user_id=admin.id, title=title, message=message,
            type="info", entity_type="course", entity_id=entity_id,
        ))


@courses_bp.route("/", methods=["GET"])
@jwt_required()
def list_courses():
    user = get_current_user()

    if user.role == Role.ADMIN:
        query = Course.query
    else:
        # Everyone sees the active catalog; instructors additionally see
        # their own courses while pending approval/deletion.
        query = Course.query.filter(
            or_(Course.status == CourseStatus.ACTIVE, Course.instructor_id == user.id)
        )
    courses = query.order_by(Course.code).all()

    enrolled_ids = {
        e.course_id
        for e in CourseEnrollment.query.filter_by(student_id=user.id).all()
    }

    result = []
    for c in courses:
        d = c.to_dict()
        d["enrolled"]          = c.id in enrolled_ids
        d["student_count"]     = c.enrollments.count()
        d["assignment_count"]  = sum(p.assignments.count() for p in c.projects.all())
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

    user = get_current_user()
    # Admin-created courses go live immediately; teacher-created courses
    # need admin sign-off before they appear in the public catalog.
    status = CourseStatus.ACTIVE if user.role == Role.ADMIN else CourseStatus.PENDING_APPROVAL

    course = Course(
        code          = data["code"].upper().strip(),
        title         = data["title"].strip(),
        description   = data.get("description", ""),
        credits       = int(data.get("credits", 3)),
        topic_keyword = data.get("topic_keyword", ""),
        instructor_id = user.id,
        status        = status,
    )
    db.session.add(course)
    db.session.flush()  # get course.id before commit

    # Auto-create a default project linked to this course
    project = Project(
        name       = course.title,
        description= f"Default project for {course.code}",
        course_id  = course.id,
        created_by = user.id,
        is_active  = True,
    )
    db.session.add(project)
    db.session.flush()

    # Add teacher as project member
    db.session.add(ProjectMember(
        project_id    = project.id,
        user_id       = user.id,
        role_in_group = "instructor",
    ))

    if status == CourseStatus.PENDING_APPROVAL:
        _notify_admins(
            "New course pending approval",
            f"{user.full_name} requested a new course: {course.code} — {course.title}",
            entity_id=course.id,
        )
        msg = "Course submitted — pending admin approval"
    else:
        msg = "Course created"

    db.session.commit()
    return success(course.to_dict(), msg, 201)


@courses_bp.route("/mine/students", methods=["GET"])
@jwt_required()
@teacher_or_admin
def my_course_students():
    """Return deduplicated list of students enrolled in any of the teacher's courses."""
    user    = get_current_user()
    courses = Course.query.filter_by(instructor_id=user.id).all()
    seen, students = set(), []
    for course in courses:
        for enrollment in course.enrollments.all():
            if enrollment.student_id not in seen:
                seen.add(enrollment.student_id)
                students.append(enrollment.student.to_dict())
    return success(students)


@courses_bp.route("/mine", methods=["GET"])
@jwt_required()
@teacher_or_admin
def my_courses():
    user    = get_current_user()
    courses = (
        Course.query
        .filter(Course.instructor_id == user.id, Course.status != CourseStatus.DELETED)
        .order_by(Course.code)
        .all()
    )
    result  = []
    for c in courses:
        d = c.to_dict()
        d["student_count"]    = c.enrollments.count()
        d["assignment_count"] = sum(p.assignments.count() for p in c.projects.all())
        result.append(d)
    return success(result)


# ── DELETE /api/courses/<id> — request/perform removal ────────────────────────

@courses_bp.route("/<course_id>", methods=["DELETE"])
@jwt_required()
@teacher_or_admin
def delete_course(course_id):
    user   = get_current_user()
    course = Course.query.get(course_id)
    if not course:
        return error("Course not found", 404)

    if user.role == Role.ADMIN:
        course.status = CourseStatus.DELETED
        db.session.commit()
        return success(None, "Course removed")

    # Teacher: only the owning instructor can request removal of their own course
    if course.instructor_id != user.id:
        return error("You can only remove your own courses", 403)
    if course.status == CourseStatus.PENDING_DELETION:
        return error("Removal already pending admin approval", 409)

    course.status = CourseStatus.PENDING_DELETION
    _notify_admins(
        "Course removal requested",
        f"{user.full_name} requested to remove course: {course.code} — {course.title}",
        entity_id=course.id,
    )
    db.session.commit()
    return success(course.to_dict(), "Removal requested — pending admin approval")


# ── GET /api/courses/pending — admin review queue ──────────────────────────────

@courses_bp.route("/pending", methods=["GET"])
@jwt_required()
def pending_courses():
    user = get_current_user()
    if user.role != Role.ADMIN:
        return error("Admin access required", 403)

    courses = (
        Course.query
        .filter(Course.status.in_([CourseStatus.PENDING_APPROVAL, CourseStatus.PENDING_DELETION]))
        .order_by(Course.created_at.desc())
        .all()
    )
    return success([c.to_dict() for c in courses])


# ── POST /api/courses/<id>/approve — admin approves pending request ───────────

@courses_bp.route("/<course_id>/approve", methods=["POST"])
@jwt_required()
def approve_course(course_id):
    user = get_current_user()
    if user.role != Role.ADMIN:
        return error("Admin access required", 403)

    course = Course.query.get(course_id)
    if not course:
        return error("Course not found", 404)
    if course.status not in (CourseStatus.PENDING_APPROVAL, CourseStatus.PENDING_DELETION):
        return error("This course has no pending request", 409)

    was_deletion = course.status == CourseStatus.PENDING_DELETION
    course.status = CourseStatus.DELETED if was_deletion else CourseStatus.ACTIVE

    if course.instructor_id:
        db.session.add(Notification(
            user_id=course.instructor_id,
            title="Course removed" if was_deletion else "Course approved",
            message=(
                f"Your removal request for {course.code} was approved."
                if was_deletion else
                f"Your course {course.code} — {course.title} was approved and is now live."
            ),
            type="info", entity_type="course", entity_id=course.id,
        ))

    db.session.commit()
    return success(course.to_dict(), "Request approved")


# ── POST /api/courses/<id>/reject — admin rejects pending request ─────────────

@courses_bp.route("/<course_id>/reject", methods=["POST"])
@jwt_required()
def reject_course(course_id):
    user = get_current_user()
    if user.role != Role.ADMIN:
        return error("Admin access required", 403)

    course = Course.query.get(course_id)
    if not course:
        return error("Course not found", 404)
    if course.status not in (CourseStatus.PENDING_APPROVAL, CourseStatus.PENDING_DELETION):
        return error("This course has no pending request", 409)

    was_deletion = course.status == CourseStatus.PENDING_DELETION
    # Rejecting a deletion request just restores the course; rejecting a new
    # course request means it never goes live.
    course.status = CourseStatus.ACTIVE if was_deletion else CourseStatus.DELETED

    if course.instructor_id:
        db.session.add(Notification(
            user_id=course.instructor_id,
            title="Removal request rejected" if was_deletion else "Course request rejected",
            message=(
                f"Your removal request for {course.code} was rejected — the course stays active."
                if was_deletion else
                f"Your course request {course.code} — {course.title} was rejected by an admin."
            ),
            type="warning", entity_type="course", entity_id=course.id,
        ))

    db.session.commit()
    return success(course.to_dict(), "Request rejected")


@courses_bp.route("/<course_id>/projects", methods=["GET"])
@jwt_required()
def course_projects(course_id):
    Course.query.get_or_404(course_id)
    projects = Project.query.filter_by(course_id=course_id, is_active=True).all()
    return success([p.to_dict() for p in projects])


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
