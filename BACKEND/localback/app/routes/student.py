"""
SkillSync — Student API
========================
Endpoints for dashboard stats, activity history, and certificates.
All endpoints require JWT authentication.

GET  /api/student/dashboard    – summary stats (sessions, streak, mastered topics, certs)
GET  /api/student/history      – paginated activity log
GET  /api/student/certificates – list of earned certificates
POST /api/student/certificates/check  – check & auto-award any newly earned track certs
"""

from datetime import datetime, timezone, timedelta
from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from app import db
from app.models import User, ActivityLog, Certificate, Topic, UserTopicProgress
from app.utils.helpers import success, error, get_current_user

student_bp = Blueprint("student", __name__)


# ── Internal: check & award track certificates ────────────────────────────────

def _award_track_certificates(user_id: int):
    """
    For every track, check if the student has mastered ALL topics in that track.
    If yes and no certificate exists yet, create one and log it.
    Returns list of newly awarded certificate dicts.
    """
    newly_awarded = []

    # Find all unique tracks
    tracks = db.session.query(Topic.track).distinct().all()

    for (track,) in tracks:
        # Already has cert for this track?
        if Certificate.query.filter_by(user_id=user_id, track=track).first():
            continue

        # All topic ids in this track
        track_topics = Topic.query.filter_by(track=track).all()
        if not track_topics:
            continue

        track_topic_ids = {t.id for t in track_topics}

        # Which of these has the student mastered?
        mastered = {
            p.topic_id
            for p in UserTopicProgress.query.filter_by(user_id=user_id, status="mastered").all()
            if p.topic_id in track_topic_ids
        }

        if mastered == track_topic_ids:
            # All mastered — award certificate
            cert = Certificate(
                user_id=user_id,
                title=f"{track} — Track Complete",
                track=track,
            )
            db.session.add(cert)
            db.session.flush()

            db.session.add(ActivityLog(
                user_id=user_id,
                action_type="certificate_earned",
                extra_data={"track": track, "title": cert.title},
            ))

            newly_awarded.append(cert.to_dict())

    if newly_awarded:
        db.session.commit()

    return newly_awarded


# ── GET /api/student/dashboard ────────────────────────────────────────────────

@student_bp.route("/dashboard", methods=["GET"])
@jwt_required()
def dashboard():
    """Returns live summary stats for the logged-in student."""
    user = get_current_user()
    if not user:
        return error("User not found", 404)

    # Total focus sessions (action_type = 'focus_session')
    total_sessions = ActivityLog.query.filter_by(
        user_id=user.id, action_type="focus_session"
    ).count()

    # Current streak: count consecutive days with a focus session, going back from today
    today = datetime.now(timezone.utc).date()
    streak = 0
    check_day = today
    while True:
        day_start = datetime(check_day.year, check_day.month, check_day.day, tzinfo=timezone.utc)
        day_end   = day_start + timedelta(days=1)
        has_session = ActivityLog.query.filter(
            ActivityLog.user_id == user.id,
            ActivityLog.action_type == "focus_session",
            ActivityLog.created_at >= day_start,
            ActivityLog.created_at <  day_end,
        ).first()
        if has_session:
            streak += 1
            check_day = check_day - timedelta(days=1)
        else:
            break

    # Topics mastered
    topics_mastered = UserTopicProgress.query.filter_by(
        user_id=user.id, status="mastered"
    ).count()

    # Certificates earned
    certs_earned = Certificate.query.filter_by(user_id=user.id).count()

    # Heatmap data: focus sessions per day for the last 20 weeks (140 days)
    cutoff = datetime.now(timezone.utc) - timedelta(days=140)
    logs = ActivityLog.query.filter(
        ActivityLog.user_id == user.id,
        ActivityLog.action_type == "focus_session",
        ActivityLog.created_at >= cutoff,
    ).all()

    # Count sessions per date string
    day_counts = {}
    for log in logs:
        d = log.created_at.strftime("%Y-%m-%d")
        day_counts[d] = day_counts.get(d, 0) + 1

    return success({
        "total_sessions":  total_sessions,
        "streak_days":     streak,
        "topics_mastered": topics_mastered,
        "certs_earned":    certs_earned,
        "heatmap":         day_counts,   # { "2026-04-12": 3, ... }
    })


# ── GET /api/student/history ──────────────────────────────────────────────────

@student_bp.route("/history", methods=["GET"])
@jwt_required()
def history():
    """Returns paginated activity log for the student."""
    user = get_current_user()
    if not user:
        return error("User not found", 404)

    page  = int(request.args.get("page",  1))
    limit = int(request.args.get("limit", 20))
    offset = (page - 1) * limit

    logs = (
        ActivityLog.query
        .filter_by(user_id=user.id)
        .order_by(ActivityLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    total = ActivityLog.query.filter_by(user_id=user.id).count()

    return success({
        "items": [l.to_dict() for l in logs],
        "total": total,
        "page":  page,
        "pages": (total + limit - 1) // limit,
    })


# ── GET /api/student/certificates ─────────────────────────────────────────────

@student_bp.route("/certificates", methods=["GET"])
@jwt_required()
def list_certificates():
    """Returns all certificates for the logged-in student."""
    user = get_current_user()
    if not user:
        return error("User not found", 404)

    # First, auto-check if any new ones should be awarded
    _award_track_certificates(user.id)

    certs = (
        Certificate.query
        .filter_by(user_id=user.id)
        .order_by(Certificate.issued_at.desc())
        .all()
    )
    return success([c.to_dict() for c in certs])


# ── POST /api/student/certificates/check ─────────────────────────────────────

@student_bp.route("/certificates/check", methods=["POST"])
@jwt_required()
def check_certificates():
    """
    Explicitly trigger a certificate check.
    Called by the frontend after a topic is mastered.
    Returns any newly awarded certificates.
    """
    user = get_current_user()
    if not user:
        return error("User not found", 404)

    newly_awarded = _award_track_certificates(user.id)
    msg = f"🎓 {len(newly_awarded)} new certificate(s) awarded!" if newly_awarded else "No new certificates."
    return success(newly_awarded, msg)


# ── POST /api/student/focus-session ──────────────────────────────────────────

@student_bp.route("/focus-session", methods=["POST"])
@jwt_required()
def log_focus_session():
    """
    Called by the Focus timer when a session completes.
    Body: { "topic": "...", "duration_minutes": 25 }
    """
    user = get_current_user()
    if not user:
        return error("User not found", 404)

    data = request.get_json(silent=True) or {}
    topic    = data.get("topic", "General")
    duration = int(data.get("duration_minutes", 25))

    log = ActivityLog(
        user_id=user.id,
        action_type="focus_session",
        extra_data={"topic": topic, "duration_minutes": duration},
    )
    db.session.add(log)

    # Also update last_active
    user.last_active = datetime.now(timezone.utc)
    db.session.commit()

    return success(log.to_dict(), "Session logged")
