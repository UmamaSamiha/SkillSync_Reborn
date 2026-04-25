"""
SkillSync — Curriculum API
===========================
Handles topics, prerequisites, and student mastery progress.

Endpoints
---------
GET  /api/curriculum/topics              – list all topics with user's status
POST /api/curriculum/topics              – admin: create a topic
GET  /api/curriculum/topics/<id>         – single topic detail + user progress
POST /api/curriculum/topics/<id>/submit  – student submits a quiz score
DELETE /api/curriculum/topics/<id>       – admin: delete a topic

Helper (internal)
-----------------
_recompute_unlock(user_id)  – after any mastery change, unlock topics whose
                              prerequisites are now all mastered.
"""

from datetime import datetime, timezone
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models import (
    User, Role, Topic, TopicPrerequisite, UserTopicProgress, ActivityLog
)
from app.utils.helpers import success, error, get_current_user

curriculum_bp = Blueprint("curriculum", __name__)


# ── Internal helpers ──────────────────────────────────────────────────────────

def _get_or_create_progress(user_id: int, topic_id: int) -> UserTopicProgress:
    """Return the progress row, creating it (locked) if missing."""
    prog = UserTopicProgress.query.filter_by(user_id=user_id, topic_id=topic_id).first()
    if not prog:
        prog = UserTopicProgress(user_id=user_id, topic_id=topic_id, status="locked")
        db.session.add(prog)
        db.session.flush()   # get the id without committing
    return prog


def _recompute_unlock(user_id: int):
    """
    After a student masters a topic, check every topic they haven't mastered yet.
    If ALL prerequisites of a topic are now mastered, set it to 'unlocked'
    (unless it's already 'in_progress' or 'mastered', in which case leave it).
    Topics with zero prerequisites are always unlocked on first sight.
    """
    all_topics = Topic.query.all()

    # Build a set of topic_ids the user has mastered
    mastered_ids = {
        p.topic_id
        for p in UserTopicProgress.query.filter_by(user_id=user_id, status="mastered").all()
    }

    for topic in all_topics:
        prog = _get_or_create_progress(user_id, topic.id)

        if prog.status in ("mastered", "in_progress"):
            # Don't downgrade or re-lock topics already in progress/mastered
            continue

        prereq_ids = {p.prerequisite_id for p in topic.prerequisites}

        if len(prereq_ids) == 0:
            # No prerequisites → always unlocked
            if prog.status == "locked":
                prog.status = "unlocked"
        else:
            if prereq_ids.issubset(mastered_ids):
                prog.status = "unlocked"
            else:
                # Some prerequisite not yet mastered → keep/set locked
                if prog.status == "unlocked":
                    # This can happen if an admin adds a new prerequisite later
                    prog.status = "locked"


# ── GET /api/curriculum/topics ────────────────────────────────────────────────

@curriculum_bp.route("/topics", methods=["GET"])
@jwt_required()
def list_topics():
    """
    Returns all topics with the calling user's current status.
    Groups them by track for easier frontend rendering.
    """
    user = get_current_user()
    if not user:
        return error("User not found", 404)

    # Recompute unlock states whenever the student views topics
    # (cheap for small curricula; can be made event-driven later)
    _recompute_unlock(user.id)
    db.session.commit()

    topics = Topic.query.order_by(Topic.track, Topic.order).all()

    result = []
    for t in topics:
        prog = UserTopicProgress.query.filter_by(user_id=user.id, topic_id=t.id).first()
        status = prog.status if prog else "locked"
        score  = prog.quiz_score if prog else None

        result.append({
            **t.to_dict(),
            "user_status": status,
            "user_score":  score,
        })

    return success(result)


# ── POST /api/curriculum/topics ───────────────────────────────────────────────

@curriculum_bp.route("/topics", methods=["POST"])
@jwt_required()
def create_topic():
    """Admin only. Creates a topic and optionally sets prerequisites."""
    user = get_current_user()
    if not user or user.role != Role.ADMIN:
        return error("Admin access required", 403)

    data = request.get_json(silent=True) or {}
    title = data.get("title", "").strip()
    if not title:
        return error("title is required", 400)

    topic = Topic(
        title             = title,
        description       = data.get("description", "").strip() or None,
        track             = data.get("track", "General").strip(),
        order             = int(data.get("order", 0)),
        mastery_threshold = int(data.get("mastery_threshold", 80)),
    )
    db.session.add(topic)
    db.session.flush()   # assigns topic.id

    # Set prerequisites
    for prereq_id in data.get("prerequisite_ids", []):
        if Topic.query.get(prereq_id):
            db.session.add(TopicPrerequisite(topic_id=topic.id, prerequisite_id=prereq_id))

    db.session.commit()
    return success(topic.to_dict(), "Topic created", 201)


# ── GET /api/curriculum/topics/<id> ──────────────────────────────────────────

@curriculum_bp.route("/topics/<int:topic_id>", methods=["GET"])
@jwt_required()
def get_topic(topic_id):
    """Single topic with full detail and user's progress."""
    user = get_current_user()
    if not user:
        return error("User not found", 404)

    topic = Topic.query.get(topic_id)
    if not topic:
        return error("Topic not found", 404)

    prog = UserTopicProgress.query.filter_by(user_id=user.id, topic_id=topic_id).first()

    return success({
        **topic.to_dict(),
        "user_status": prog.status if prog else "locked",
        "user_score":  prog.quiz_score if prog else None,
        "attempts":    prog.attempts if prog else 0,
    })


# ── POST /api/curriculum/topics/<id>/submit ───────────────────────────────────

@curriculum_bp.route("/topics/<int:topic_id>/submit", methods=["POST"])
@jwt_required()
def submit_quiz(topic_id):
    """
    Student submits a quiz score for a topic.
    Rules:
      - Topic must be 'unlocked' or 'in_progress' (not locked, not mastered again
        unless admin decides to allow re-attempts — here we allow it).
      - If score >= mastery_threshold → status becomes 'mastered' and downstream
        topics get unlocked.
      - Otherwise → status stays/becomes 'in_progress'.
    """
    user = get_current_user()
    if not user:
        return error("User not found", 404)

    topic = Topic.query.get(topic_id)
    if not topic:
        return error("Topic not found", 404)

    data  = request.get_json(silent=True) or {}
    score = data.get("score")

    if score is None or not isinstance(score, (int, float)):
        return error("score (integer 0-100) is required", 400)

    score = max(0, min(100, int(score)))

    # Check prerequisite gate
    prog = _get_or_create_progress(user.id, topic_id)

    if prog.status == "locked":
        # Double-check — maybe prerequisites were just mastered
        _recompute_unlock(user.id)
        db.session.flush()
        prog = UserTopicProgress.query.filter_by(user_id=user.id, topic_id=topic_id).first()
        if prog.status == "locked":
            return error(
                "This topic is locked. Complete the prerequisites first.",
                403
            )

    prog.attempts   += 1
    prog.quiz_score  = max(prog.quiz_score or 0, score)   # keep best score

    previously_mastered = prog.status == "mastered"

    if score >= topic.mastery_threshold:
        prog.status = "mastered"
        prog.updated_at = datetime.now(timezone.utc)

        # Log the mastery event
        db.session.add(ActivityLog(
            user_id=user.id,
            action_type="topic_mastered",
            extra_data={"topic_id": topic_id, "topic_title": topic.title, "score": score},
        ))

        # Unlock downstream topics
        _recompute_unlock(user.id)
        db.session.commit()

        return success(prog.to_dict(),
                       f"🎉 Mastery achieved! Score: {score}/{topic.mastery_threshold} required.")
    else:
        prog.status = "in_progress"
        prog.updated_at = datetime.now(timezone.utc)
        db.session.commit()

        needed = topic.mastery_threshold - score
        return success(prog.to_dict(),
                       f"Score recorded: {score}. You need {needed} more points to master this topic.")


# ── DELETE /api/curriculum/topics/<id> ───────────────────────────────────────

@curriculum_bp.route("/topics/<int:topic_id>", methods=["DELETE"])
@jwt_required()
def delete_topic(topic_id):
    """Admin only."""
    user = get_current_user()
    if not user or user.role != Role.ADMIN:
        return error("Admin access required", 403)

    topic = Topic.query.get(topic_id)
    if not topic:
        return error("Topic not found", 404)

    db.session.delete(topic)
    db.session.commit()
    return success(None, "Topic deleted")
