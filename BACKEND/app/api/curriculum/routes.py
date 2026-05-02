from datetime import datetime, timezone
from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from app import db
from app.models import (
    User, AnushkaTopic, AnushkaTopicPrerequisite, AnushkaUserTopicProgress
)
from app.utils.helpers import success, error, get_current_user

curriculum_bp = Blueprint("anushka_curriculum", __name__)


def _get_or_create_progress(user_id, topic_id):
    prog = AnushkaUserTopicProgress.query.filter_by(user_id=user_id, topic_id=topic_id).first()
    if not prog:
        prog = AnushkaUserTopicProgress(user_id=user_id, topic_id=topic_id, status="locked")
        db.session.add(prog)
        db.session.flush()
    return prog


def _recompute_unlock(user_id):
    all_topics = AnushkaTopic.query.all()
    mastered_ids = {
        p.topic_id
        for p in AnushkaUserTopicProgress.query.filter_by(user_id=user_id, status="mastered").all()
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


@curriculum_bp.route("/topics", methods=["GET"])
@jwt_required()
def list_topics():
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    _recompute_unlock(user.id)
    db.session.commit()
    topics = AnushkaTopic.query.order_by(AnushkaTopic.track, AnushkaTopic.order).all()
    result = []
    for t in topics:
        prog = AnushkaUserTopicProgress.query.filter_by(user_id=user.id, topic_id=t.id).first()
        result.append({
            **t.to_dict(),
            "user_status": prog.status if prog else "locked",
            "user_score":  prog.quiz_score if prog else None,
        })
    return success(result)


@curriculum_bp.route("/topics", methods=["POST"])
@jwt_required()
def create_topic():
    user = get_current_user()
    if not user or str(user.role) not in ("admin", "teacher"):
        return error("Admin or Teacher access required", 403)
    data = request.get_json(silent=True) or {}
    title = data.get("title", "").strip()
    if not title:
        return error("title is required", 400)
    topic = AnushkaTopic(
        title             = title,
        description       = data.get("description", "").strip() or None,
        track             = data.get("track", "General").strip(),
        order             = int(data.get("order", 0)),
        mastery_threshold = int(data.get("mastery_threshold", 80)),
    )
    db.session.add(topic)
    db.session.flush()
    for prereq_id in data.get("prerequisite_ids", []):
        if AnushkaTopic.query.get(prereq_id):
            db.session.add(AnushkaTopicPrerequisite(topic_id=topic.id, prerequisite_id=prereq_id))
    db.session.commit()
    return success(topic.to_dict(), "Topic created", 201)


@curriculum_bp.route("/topics/<int:topic_id>", methods=["GET"])
@jwt_required()
def get_topic(topic_id):
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    topic = AnushkaTopic.query.get(topic_id)
    if not topic:
        return error("Topic not found", 404)
    prog = AnushkaUserTopicProgress.query.filter_by(user_id=user.id, topic_id=topic_id).first()
    return success({
        **topic.to_dict(),
        "user_status": prog.status if prog else "locked",
        "user_score":  prog.quiz_score if prog else None,
        "attempts":    prog.attempts if prog else 0,
    })


@curriculum_bp.route("/topics/<int:topic_id>/submit", methods=["POST"])
@jwt_required()
def submit_quiz(topic_id):
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    topic = AnushkaTopic.query.get(topic_id)
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
        prog = AnushkaUserTopicProgress.query.filter_by(user_id=user.id, topic_id=topic_id).first()
        if prog.status == "locked":
            return error("This topic is locked. Complete the prerequisites first.", 403)
    prog.attempts  += 1
    prog.quiz_score = max(prog.quiz_score or 0, score)
    if score >= topic.mastery_threshold:
        prog.status = "mastered"
        prog.updated_at = datetime.now(timezone.utc)
        _recompute_unlock(user.id)
        db.session.commit()
        return success(prog.to_dict(), f"🎉 Mastery achieved! Score: {score}/{topic.mastery_threshold} required.")
    else:
        prog.status = "in_progress"
        prog.updated_at = datetime.now(timezone.utc)
        db.session.commit()
        return success(prog.to_dict(), f"Score recorded: {score}. You need {topic.mastery_threshold - score} more points.")


@curriculum_bp.route("/topics/<int:topic_id>", methods=["PUT"])
@jwt_required()
def update_topic(topic_id):
    user = get_current_user()
    if not user or str(user.role) not in ("admin", "teacher"):
        return error("Admin or Teacher access required", 403)
    topic = AnushkaTopic.query.get(topic_id)
    if not topic:
        return error("Topic not found", 404)
    data = request.get_json(silent=True) or {}
    if "title" in data:
        topic.title = data["title"].strip()
    if "description" in data:
        topic.description = data["description"].strip() or None
    if "track" in data:
        topic.track = data["track"].strip()
    if "order" in data:
        topic.order = int(data["order"])
    if "mastery_threshold" in data:
        topic.mastery_threshold = int(data["mastery_threshold"])
    if "prerequisite_ids" in data:
        AnushkaTopicPrerequisite.query.filter_by(topic_id=topic_id).delete()
        for prereq_id in data["prerequisite_ids"]:
            if AnushkaTopic.query.get(prereq_id):
                db.session.add(AnushkaTopicPrerequisite(topic_id=topic_id, prerequisite_id=prereq_id))
    db.session.commit()
    return success(topic.to_dict(), "Topic updated")


@curriculum_bp.route("/topics/<int:topic_id>", methods=["DELETE"])
@jwt_required()
def delete_topic(topic_id):
    user = get_current_user()
    if not user or str(user.role) not in ("admin", "teacher"):
        return error("Admin or Teacher access required", 403)
    topic = AnushkaTopic.query.get(topic_id)
    if not topic:
        return error("Topic not found", 404)
    db.session.delete(topic)
    db.session.commit()
    return success(None, "Topic deleted")


@curriculum_bp.route("/topics/<int:topic_id>/prerequisites", methods=["POST"])
@jwt_required()
def add_prerequisite(topic_id):
    user = get_current_user()
    if not user or str(user.role) not in ("admin", "teacher"):
        return error("Admin or Teacher access required", 403)
    topic = AnushkaTopic.query.get(topic_id)
    if not topic:
        return error("Topic not found", 404)
    data = request.get_json(silent=True) or {}
    prereq_id = data.get("prerequisite_id")
    if not prereq_id or not AnushkaTopic.query.get(prereq_id):
        return error("Valid prerequisite_id is required", 400)
    existing = AnushkaTopicPrerequisite.query.filter_by(
        topic_id=topic_id, prerequisite_id=prereq_id
    ).first()
    if existing:
        return error("Prerequisite already exists", 400)
    db.session.add(AnushkaTopicPrerequisite(topic_id=topic_id, prerequisite_id=prereq_id))
    db.session.commit()
    return success(topic.to_dict(), "Prerequisite added")