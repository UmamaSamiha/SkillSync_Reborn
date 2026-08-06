"""
SkillSync — Live Classes API
==============================
Real-time video classes, scheduled per course and hosted on Jitsi Meet
(https://meet.jit.si — free, no API key required). This module owns
scheduling, access control, and attendance tracking; the actual audio/
video happens client-side via the Jitsi embed using the room_slug below.

GET    /api/live-classes/                    List classes visible to current user
GET    /api/live-classes/<id>                Class detail
POST   /api/live-classes/                    Schedule a class            (teacher/admin)
POST   /api/live-classes/<id>/start          Start class -> status=live  (host/admin)
POST   /api/live-classes/<id>/end            End class -> status=ended   (host/admin)
POST   /api/live-classes/<id>/join           Join room, records attendance
POST   /api/live-classes/<id>/leave          Leave room, closes attendance
DELETE /api/live-classes/<id>                Cancel a scheduled class    (host/admin)
GET    /api/live-classes/<id>/attendance     Attendance roster           (host/admin)
"""

from datetime import datetime, timezone

from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required

from app import db
from app.models import (
    LiveClass, LiveClassAttendance, LiveClassStatus,
    Course, CourseEnrollment, Notification, Role,
)
from app.utils.helpers import success, error, get_current_user

live_classes_bp = Blueprint("live_classes", __name__)


# ── Access helpers ──────────────────────────────────────────────────────────

def _can_manage_course(user, course):
    """Teacher who owns the course, or an admin."""
    if user.role == Role.ADMIN:
        return True
    return user.role == Role.TEACHER and course.instructor_id == user.id


def _can_view_course(user, course):
    """Anyone enrolled, the instructor, or an admin."""
    if _can_manage_course(user, course):
        return True
    return CourseEnrollment.query.filter_by(
        course_id=course.id, student_id=user.id
    ).first() is not None


def _parse_datetime(value):
    if not value:
        return None
    try:
        # Accept both "...Z" and "+00:00" style ISO strings from the browser
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


# ── GET /api/live-classes/ ───────────────────────────────────────────────────

@live_classes_bp.route("/", methods=["GET"])
@jwt_required()
def list_live_classes():
    user = get_current_user()
    if not user:
        return error("Unauthorized", 401)

    if user.role == Role.ADMIN:
        course_ids = [c.id for c in Course.query.all()]
    elif user.role == Role.TEACHER:
        course_ids = [c.id for c in Course.query.filter_by(instructor_id=user.id).all()]
    else:
        course_ids = [
            e.course_id for e in CourseEnrollment.query.filter_by(student_id=user.id).all()
        ]

    query = LiveClass.query.filter(LiveClass.course_id.in_(course_ids))

    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)

    course_id = request.args.get("course_id")
    if course_id:
        query = query.filter_by(course_id=course_id)

    classes = query.order_by(LiveClass.scheduled_at.desc()).all()
    return success([c.to_dict(current_user_id=user.id) for c in classes])


# ── GET /api/live-classes/<id> ───────────────────────────────────────────────

@live_classes_bp.route("/<class_id>", methods=["GET"])
@jwt_required()
def get_live_class(class_id):
    user = get_current_user()
    lc = LiveClass.query.get_or_404(class_id)

    if not _can_view_course(user, lc.course):
        return error("Forbidden", 403)

    return success(lc.to_dict(current_user_id=user.id))


# ── POST /api/live-classes/ ──────────────────────────────────────────────────

@live_classes_bp.route("/", methods=["POST"])
@jwt_required()
def create_live_class():
    user = get_current_user()
    if user.role not in (Role.TEACHER, Role.ADMIN):
        return error("Forbidden", 403)

    data = request.get_json(silent=True) or {}
    missing = [f for f in ("course_id", "title", "scheduled_at") if not data.get(f)]
    if missing:
        return error(f"Missing required fields: {', '.join(missing)}", 400)

    course = Course.query.get(data["course_id"])
    if not course:
        return error("Course not found", 404)

    if not _can_manage_course(user, course):
        return error("You can only schedule classes for your own courses", 403)

    scheduled_at = _parse_datetime(data["scheduled_at"])
    if not scheduled_at:
        return error("scheduled_at must be a valid ISO datetime", 400)

    lc = LiveClass(
        course_id    = course.id,
        host_id      = user.id,
        title        = data["title"].strip(),
        description  = data.get("description", "").strip(),
        scheduled_at = scheduled_at,
    )
    db.session.add(lc)
    db.session.flush()

    # Notify enrolled students
    enrollments = CourseEnrollment.query.filter_by(course_id=course.id).all()
    for e in enrollments:
        db.session.add(Notification(
            user_id     = e.student_id,
            title       = "New live class scheduled",
            message     = f"{lc.title} for {course.code} is scheduled.",
            type        = "live_class",
            entity_type = "live_class",
            entity_id   = lc.id,
        ))

    db.session.commit()
    return success(lc.to_dict(current_user_id=user.id), "Live class scheduled", 201)


# ── POST /api/live-classes/<id>/start ────────────────────────────────────────

@live_classes_bp.route("/<class_id>/start", methods=["POST"])
@jwt_required()
def start_live_class(class_id):
    user = get_current_user()
    lc = LiveClass.query.get_or_404(class_id)

    if lc.host_id != user.id and user.role != Role.ADMIN:
        return error("Only the host can start this class", 403)

    if lc.status not in (LiveClassStatus.SCHEDULED,):
        return error(f"Class cannot be started from status '{lc.status}'", 409)

    lc.status     = LiveClassStatus.LIVE
    lc.started_at = datetime.now(timezone.utc)
    db.session.commit()

    return success(lc.to_dict(current_user_id=user.id), "Class started")


# ── POST /api/live-classes/<id>/end ──────────────────────────────────────────

@live_classes_bp.route("/<class_id>/end", methods=["POST"])
@jwt_required()
def end_live_class(class_id):
    user = get_current_user()
    lc = LiveClass.query.get_or_404(class_id)

    if lc.host_id != user.id and user.role != Role.ADMIN:
        return error("Only the host can end this class", 403)

    if lc.status != LiveClassStatus.LIVE:
        return error("Class is not currently live", 409)

    now = datetime.now(timezone.utc)
    lc.status   = LiveClassStatus.ENDED
    lc.ended_at = now

    # Close out anyone still marked as present
    still_present = LiveClassAttendance.query.filter_by(
        live_class_id=lc.id, left_at=None
    ).all()
    for a in still_present:
        a.left_at = now

    db.session.commit()
    return success(lc.to_dict(current_user_id=user.id), "Class ended")


# ── POST /api/live-classes/<id>/join ─────────────────────────────────────────

@live_classes_bp.route("/<class_id>/join", methods=["POST"])
@jwt_required()
def join_live_class(class_id):
    user = get_current_user()
    lc = LiveClass.query.get_or_404(class_id)

    if not _can_view_course(user, lc.course):
        return error("Forbidden", 403)

    if lc.status == LiveClassStatus.SCHEDULED and lc.host_id == user.id:
        # Host joining auto-starts the class
        lc.status     = LiveClassStatus.LIVE
        lc.started_at = datetime.now(timezone.utc)
        db.session.commit()

    if lc.status != LiveClassStatus.LIVE:
        return error(f"Class is not live yet (status: {lc.status})", 409)

    # Reuse an open attendance row if the user is rejoining, else create one
    attendance = LiveClassAttendance.query.filter_by(
        live_class_id=lc.id, user_id=user.id, left_at=None
    ).first()
    if not attendance:
        attendance = LiveClassAttendance(live_class_id=lc.id, user_id=user.id)
        db.session.add(attendance)
        db.session.commit()

    return success({
        "class":        lc.to_dict(current_user_id=user.id),
        "jitsi_domain": current_app.config["JITSI_DOMAIN"],
        "room_name":    f"skillsync-{lc.room_slug}",
        "display_name": user.full_name,
        "is_moderator": lc.host_id == user.id or user.role == Role.ADMIN,
    }, "Joined class")


# ── POST /api/live-classes/<id>/leave ────────────────────────────────────────

@live_classes_bp.route("/<class_id>/leave", methods=["POST"])
@jwt_required()
def leave_live_class(class_id):
    user = get_current_user()
    lc = LiveClass.query.get_or_404(class_id)

    attendance = LiveClassAttendance.query.filter_by(
        live_class_id=lc.id, user_id=user.id, left_at=None
    ).first()
    if attendance:
        attendance.left_at = datetime.now(timezone.utc)
        db.session.commit()

    return success(None, "Left class")


# ── DELETE /api/live-classes/<id> ────────────────────────────────────────────

@live_classes_bp.route("/<class_id>", methods=["DELETE"])
@jwt_required()
def cancel_live_class(class_id):
    user = get_current_user()
    lc = LiveClass.query.get_or_404(class_id)

    if lc.host_id != user.id and user.role != Role.ADMIN:
        return error("Only the host can cancel this class", 403)

    if lc.status == LiveClassStatus.LIVE:
        return error("End the class before canceling it", 409)

    lc.status = LiveClassStatus.CANCELED
    db.session.commit()
    return success(None, "Class canceled")


# ── GET /api/live-classes/<id>/attendance ────────────────────────────────────

@live_classes_bp.route("/<class_id>/attendance", methods=["GET"])
@jwt_required()
def class_attendance(class_id):
    user = get_current_user()
    lc = LiveClass.query.get_or_404(class_id)

    if not _can_manage_course(user, lc.course):
        return error("Forbidden", 403)

    records = lc.attendance.order_by(LiveClassAttendance.joined_at.asc()).all()
    return success([r.to_dict() for r in records])
