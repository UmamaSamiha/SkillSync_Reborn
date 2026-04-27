from datetime import datetime, timezone
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from app import db
from app.models import (
    User, AnushkaTopic, AnushkaUserTopicProgress,
    AnushkaTopicPrerequisite, AnushkaSubmission, AnushkaEditEvent
)
from app.utils.helpers import success, error, get_current_user

edit_tracking_bp = Blueprint("anushka_edit_tracking", __name__)


def _recompute_unlock(user_id):
    all_topics = AnushkaTopic.query.all()
    mastered_ids = {
        p.topic_id
        for p in AnushkaUserTopicProgress.query.filter_by(user_id=user_id, status="mastered").all()
    }
    for topic in all_topics:
        prog = AnushkaUserTopicProgress.query.filter_by(user_id=user_id, topic_id=topic.id).first()
        if not prog:
            prog = AnushkaUserTopicProgress(user_id=user_id, topic_id=topic.id, status="locked")
            db.session.add(prog)
            db.session.flush()
        if prog.status in ("mastered", "in_progress"):
            continue
        prereq_ids = {p.prerequisite_id for p in topic.prerequisites}
        if len(prereq_ids) == 0:
            prog.status = "unlocked"
        else:
            if prereq_ids.issubset(mastered_ids):
                prog.status = "unlocked"
            else:
                if prog.status == "unlocked":
                    prog.status = "locked"


@edit_tracking_bp.route("/track", methods=["POST"])
@jwt_required()
def track_edit():
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    data         = request.get_json(silent=True) or {}
    text         = data.get("text", "")
    prev_text    = data.get("prev_text", "")
    is_paste     = data.get("is_paste", False)
    sub_id       = data.get("submission_id")
    title        = data.get("title", "Untitled")
    content_type = data.get("content_type", "quiz")
    topic_name   = data.get("topic_name", "")
    topic_id     = data.get("topic_id")
    chars_added   = max(0, len(text) - len(prev_text))
    chars_removed = max(0, len(prev_text) - len(text))
    if chars_added >= 50:
        is_paste = True
    if sub_id:
        submission = AnushkaSubmission.query.filter_by(id=sub_id, user_id=user.id).first()
        if not submission:
            return error("Submission not found", 404)
    else:
        submission = AnushkaSubmission(
            user_id=user.id,
            title=title,
            content_type=content_type,
            topic_name=topic_name or None,
            topic_id=topic_id or None,
        )
        db.session.add(submission)
        db.session.flush()
    submission.final_text = text
    submission.updated_at = datetime.now(timezone.utc)
    event = AnushkaEditEvent(
        submission_id=submission.id,
        text_snapshot=text,
        chars_added=chars_added,
        chars_removed=chars_removed,
        is_paste=is_paste,
    )
    db.session.add(event)
    db.session.commit()
    return success({
        "submission_id": submission.id,
        "event_id":      event.id,
        "is_paste":      is_paste,
        "chars_added":   chars_added,
    })


@edit_tracking_bp.route("/submissions", methods=["GET"])
@jwt_required()
def list_submissions():
    user = get_current_user()
    if not user or str(user.role) not in ("admin", "teacher"):
        return error("Admin or Teacher access required", 403)
    submissions = AnushkaSubmission.query.order_by(AnushkaSubmission.updated_at.desc()).all()
    return success([s.to_dict() for s in submissions])


@edit_tracking_bp.route("/submission/<int:sub_id>", methods=["GET"])
@jwt_required()
def get_submission(sub_id):
    user = get_current_user()
    if not user or str(user.role) not in ("admin", "teacher"):
        return error("Admin or Teacher access required", 403)
    submission = AnushkaSubmission.query.get(sub_id)
    if not submission:
        return error("Submission not found", 404)
    events = AnushkaEditEvent.query.filter_by(submission_id=sub_id).order_by(AnushkaEditEvent.created_at.asc()).all()
    return success({**submission.to_dict(), "timeline": [e.to_dict() for e in events]})


@edit_tracking_bp.route("/submission/<int:sub_id>/score", methods=["POST"])
@jwt_required()
def score_submission(sub_id):
    user = get_current_user()
    if not user or str(user.role) not in ("admin", "teacher"):
        return error("Admin or Teacher access required", 403)
    submission = AnushkaSubmission.query.get(sub_id)
    if not submission:
        return error("Submission not found", 404)
    data  = request.get_json(silent=True) or {}
    score = data.get("score")
    if score is None or not isinstance(score, (int, float)):
        return error("score (0-100) is required", 400)
    score = max(0, min(100, int(score)))
    submission.teacher_score = score
    submission.scored_by     = user.id
    submission.scored_at     = datetime.now(timezone.utc)
    unlocked = False
    student  = submission.user
    if student and submission.topic_id:
        topic = AnushkaTopic.query.get(submission.topic_id)
        if topic and score >= topic.mastery_threshold:
            prog = AnushkaUserTopicProgress.query.filter_by(
                user_id=student.id, topic_id=topic.id
            ).first()
            if not prog:
                prog = AnushkaUserTopicProgress(user_id=student.id, topic_id=topic.id, status="locked")
                db.session.add(prog)
                db.session.flush()
            if prog.status != "mastered":
                prog.status     = "mastered"
                prog.quiz_score = score
                prog.updated_at = datetime.now(timezone.utc)
                unlocked = True
            _recompute_unlock(student.id)
    db.session.commit()
    return success(
        {**submission.to_dict(), "unlocked": unlocked},
        f"✅ Score {score} applied."
    )