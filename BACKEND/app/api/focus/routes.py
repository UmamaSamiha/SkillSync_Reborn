"""
SkillSync — Focus Mode API
===========================
Pomodoro session management: start, complete, history,
and per-topic analytics.
"""

from datetime import datetime, timezone
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from app import db
from app.models import FocusSession, SessionStatus, ActivityLog
from app.utils.helpers import success, error, paginate, get_current_user, validate_required

focus_bp = Blueprint("focus", __name__)


# ── POST /api/focus/start ─────────────────────────────────────────────────────

@focus_bp.route("/start", methods=["POST"])
@jwt_required()
def start_session():
    """
    Start a new Pomodoro session.
    Body: { topic_label, topic_id?, duration_minutes? }
    """
    user = get_current_user()
    data = request.get_json(silent=True) or {}

    # Check if there's already an active session
    active = FocusSession.query.filter_by(
        user_id=user.id,
        status=SessionStatus.IN_PROGRESS
    ).first()
    if active:
        return error("You already have an active session. Complete or skip it first.", 409)

    duration = int(data.get("duration_minutes", 25))
    if duration not in [5, 10, 15, 20, 25, 30, 45, 60, 90]:
        duration = 25  # Default to standard Pomodoro

    session = FocusSession(
        user_id          = user.id,
        topic_id         = data.get("topic_id"),
        topic_label      = data.get("topic_label", "General Study"),
        duration_minutes = duration,
        status           = SessionStatus.IN_PROGRESS,
        started_at       = datetime.now(timezone.utc),
        sessions_count   = 0,
    )
    db.session.add(session)
    db.session.commit()

    return success(session.to_dict(), "Session started", 201)


# ── PUT /api/focus/<session_id>/complete ──────────────────────────────────────

@focus_bp.route("/<session_id>/complete", methods=["PUT"])
@jwt_required()
def complete_session(session_id):
    """
    Mark a session as completed.
    Body: { sessions_count, notes? }
    """
    user    = get_current_user()
    session = FocusSession.query.get_or_404(session_id)

    if session.user_id != user.id:
        return error("Forbidden", 403)

    if session.status != SessionStatus.IN_PROGRESS:
        return error("Session is not active", 400)

    data = request.get_json(silent=True) or {}
    session.status         = SessionStatus.COMPLETED
    session.ended_at       = datetime.now(timezone.utc)
    session.sessions_count = int(data.get("sessions_count", 1))
    session.notes          = data.get("notes", "")

    # Log activity
    log = ActivityLog(
        user_id=user.id,
        action_type="focus_session",
        extra_data={"duration_minutes": session.duration_minutes, "topic": session.topic_label},
    )
    db.session.add(log)
    db.session.commit()

    return success(session.to_dict(), "Session completed")


# ── PUT /api/focus/<session_id>/interrupt ─────────────────────────────────────

@focus_bp.route("/<session_id>/interrupt", methods=["PUT"])
@jwt_required()
def interrupt_session(session_id):
    """Mark a session as interrupted (user clicked Skip/Exit)."""
    user    = get_current_user()
    session = FocusSession.query.get_or_404(session_id)

    if session.user_id != user.id:
        return error("Forbidden", 403)

    session.status   = SessionStatus.INTERRUPTED
    session.ended_at = datetime.now(timezone.utc)
    db.session.commit()

    return success(session.to_dict(), "Session interrupted")


# ── GET /api/focus/history ────────────────────────────────────────────────────

@focus_bp.route("/history", methods=["GET"])
@jwt_required()
def session_history():
    """
    Paginated session history for the current user.
    Query: ?topic_label= &status= &page= &per_page=
    """
    user  = get_current_user()
    query = FocusSession.query.filter_by(user_id=user.id)

    if request.args.get("topic_label"):
        query = query.filter_by(topic_label=request.args["topic_label"])
    if request.args.get("status"):
        query = query.filter_by(status=request.args["status"])

    result = paginate(
        query.order_by(FocusSession.started_at.desc()),
        lambda s: s.to_dict()
    )
    return success(result)


# ── GET /api/focus/active ─────────────────────────────────────────────────────

@focus_bp.route("/active", methods=["GET"])
@jwt_required()
def active_session():
    """Return the currently active session, if any."""
    user    = get_current_user()
    session = FocusSession.query.filter_by(
        user_id=user.id,
        status=SessionStatus.IN_PROGRESS
    ).first()
    return success(session.to_dict() if session else None)


# ── GET /api/focus/stats ──────────────────────────────────────────────────────

@focus_bp.route("/stats", methods=["GET"])
@jwt_required()
def focus_stats():
    """
    Aggregate stats for the current user:
    total hours, sessions completed, streak, most studied topic.
    """
    user = get_current_user()

    completed = FocusSession.query.filter_by(
        user_id=user.id,
        status=SessionStatus.COMPLETED
    ).all()

    total_minutes   = sum(s.duration_minutes for s in completed)
    total_sessions  = len(completed)

    # Most studied topic
    topic_counts = {}
    for s in completed:
        topic_counts[s.topic_label or "General"] = topic_counts.get(s.topic_label or "General", 0) + 1
    top_topic = max(topic_counts, key=topic_counts.get) if topic_counts else "N/A"

    return success({
        "total_hours":        round(total_minutes / 60, 1),
        "total_sessions":     total_sessions,
        "sessions_completed": sum(s.sessions_count for s in completed),
        "top_topic":          top_topic,
    })