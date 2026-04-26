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
PUT  /api/curriculum/topics/<id>         – admin: update a topic
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
        db.session.flush()
    return prog


def _recompute_unlock(user_id: int):
    """
    After a student masters a topic, check every topic they haven't mastered yet.
    If ALL prerequisites of a topic are now mastered, set it to 'unlocked'
    (unless it's already 'in_progress' or 'mastered', in which case leave it).
    Topics with zero prerequisites are always unlocked on first sight.
    """
    all_topics = Topic.query.all()

    mastered_ids = {
        p.topic_id
        for p in UserTopicProgress.query.filter_by(user_id=user_id, status="mastered").all()
    }

    for topic in all_topics:
        prog = _get_or_create_progress(user_id, topic.id)

        if prog.status in ("mastered", "in_progress"):
            continue

        prereq_ids = {p.prerequisite_id for p in topic.prerequisites}

        if len(prereq_ids) == 0:
            if prog.status == "locked":
                prog.status = "unlocked"
        else:
            if prereq_ids.issubset(mastered_ids):
                prog.status = "unlocked"
            else:
                if prog.status == "unlocked":
                    prog.status = "locked"


# ── GET /api/curriculum/topics ────────────────────────────────────────────────

@curriculum_bp.route("/topics", methods=["GET"])
@jwt_required()
def list_topics():
    user = get_current_user()
    if not user:
        return error("User not found", 404)

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
    """Admin/Teacher only. Creates a topic and optionally sets prerequisites."""
    user = get_current_user()
    if not user or str(user.role) not in ("admin", "teacher", "Role.ADMIN", "Role.TEACHER"):
        return error("Admin or Teacher access required", 403)

    data = request.get_json(silent=True) or {}
    title = data.get("title", "").strip()
    if not title:
        return error("title is required", 400)

    topic = Topic(
        title             = title,
        description       = data.get("description", "").strip() or None,
        track             = data.get("track", "General").strip(),
        order             = int(data.get("order", 0)),
        mastery_threshold = int(data.get("mastery_threshold", 75)),
    )
    db.session.add(topic)
    db.session.flush()

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


# ── PUT /api/curriculum/topics/<id> ──────────────────────────────────────────

@curriculum_bp.route("/topics/<int:topic_id>", methods=["PUT"])
@jwt_required()
def update_topic(topic_id):
    """Admin/Teacher only. Updates an existing topic's fields and prerequisites."""
    user = get_current_user()
    if not user or str(user.role) not in ("admin", "teacher", "Role.ADMIN", "Role.TEACHER"):
        return error("Admin or Teacher access required", 403)

    topic = Topic.query.get(topic_id)
    if not topic:
        return error("Topic not found", 404)

    data = request.get_json(silent=True) or {}

    if "title" in data:
        title = data["title"].strip()
        if not title:
            return error("title cannot be empty", 400)
        topic.title = title

    if "description" in data:
        topic.description = data["description"].strip() or None

    if "track" in data:
        topic.track = data["track"].strip() or topic.track

    if "order" in data:
        topic.order = int(data["order"])

    if "mastery_threshold" in data:
        topic.mastery_threshold = max(1, min(100, int(data["mastery_threshold"])))

    if "prerequisite_ids" in data:
        TopicPrerequisite.query.filter_by(topic_id=topic_id).delete()
        for prereq_id in data["prerequisite_ids"]:
            if prereq_id != topic_id and Topic.query.get(prereq_id):
                db.session.add(TopicPrerequisite(
                    topic_id=topic_id,
                    prerequisite_id=prereq_id,
                ))

    db.session.commit()

    # Recompute unlock states for all users after a topic change
    from sqlalchemy import distinct
    user_ids = [r[0] for r in db.session.query(distinct(UserTopicProgress.user_id)).all()]
    for uid in user_ids:
        _recompute_unlock(uid)
    db.session.commit()

    return success(topic.to_dict(), "Topic updated")


# ── POST /api/curriculum/topics/<id>/submit ───────────────────────────────────

@curriculum_bp.route("/topics/<int:topic_id>/submit", methods=["POST"])
@jwt_required()
def submit_quiz(topic_id):
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

    prog = _get_or_create_progress(user.id, topic_id)

    if prog.status == "locked":
        _recompute_unlock(user.id)
        db.session.flush()
        prog = UserTopicProgress.query.filter_by(user_id=user.id, topic_id=topic_id).first()
        if prog.status == "locked":
            return error(
                "This topic is locked. Complete the prerequisites first.",
                403
            )

    prog.attempts   += 1
    prog.quiz_score  = max(prog.quiz_score or 0, score)

    previously_mastered = prog.status == "mastered"

    if score >= topic.mastery_threshold:
        prog.status = "mastered"
        prog.updated_at = datetime.now(timezone.utc)

        db.session.add(ActivityLog(
            user_id=user.id,
            action_type="topic_mastered",
            extra_data={"topic_id": topic_id, "topic_title": topic.title, "score": score},
        ))

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
    """Admin/Teacher only."""
    user = get_current_user()
    if not user or str(user.role) not in ("admin", "teacher", "Role.ADMIN", "Role.TEACHER"):
        return error("Admin or Teacher access required", 403)

    topic = Topic.query.get(topic_id)
    if not topic:
        return error("Topic not found", 404)

    # Delete prerequisite links where this topic appears on either side
    TopicPrerequisite.query.filter(
        (TopicPrerequisite.topic_id == topic_id) |
        (TopicPrerequisite.prerequisite_id == topic_id)
    ).delete(synchronize_session=False)

    # Delete all student progress records for this topic
    UserTopicProgress.query.filter_by(topic_id=topic_id).delete(synchronize_session=False)

    db.session.delete(topic)
    db.session.commit()
    return success(None, "Topic deleted")