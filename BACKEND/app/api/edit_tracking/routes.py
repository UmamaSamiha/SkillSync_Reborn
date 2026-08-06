from datetime import datetime, timezone
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from app import db
from app.models import (
    User, AnushkaTopic, AnushkaUserTopicProgress,
    AnushkaTopicPrerequisite, AnushkaSubmission, AnushkaEditEvent, Certificate, Notification
)
from app.utils.helpers import success, error, get_current_user
from app.api.certificates.routes import issue_certificate

edit_tracking_bp = Blueprint("anushka_edit_tracking", __name__)


def _recompute_unlock(user_id, course_id=None):
    query = AnushkaTopic.query
    if course_id:
        query = query.filter_by(course_id=course_id)
    all_topics = query.all()
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
        if topic.is_final_exam:
            prereq_ids = {t.id for t in all_topics if t.id != topic.id}
        else:
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
    data     = request.get_json(silent=True) or {}
    score    = data.get("score")
    feedback = (data.get("feedback") or "").strip()
    if score is None or not isinstance(score, (int, float)):
        return error("score (0-100) is required", 400)
    score = max(0, min(100, int(score)))
    submission.teacher_score = score
    submission.scored_by     = user.id
    submission.scored_at     = datetime.now(timezone.utc)
    unlocked      = False
    cert_earned   = False
    passed        = False
    topic         = None
    student  = submission.user
    if student and submission.topic_id:
        topic = AnushkaTopic.query.get(submission.topic_id)
        if topic:
            passed = score >= topic.mastery_threshold
        if topic and passed:
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
                if topic.is_final_exam and topic.course_id:
                    existing_cert = Certificate.query.filter_by(
                        user_id=student.id, course_id=topic.course_id
                    ).first()
                    if not existing_cert:
                        issue_certificate(
                            student,
                            course_id = topic.course_id,
                            title     = f"Certificate of Completion — {topic.course.title}",
                        )
                        cert_earned = True
            _recompute_unlock(student.id, topic.course_id)

    if student:
        step_ref = f' for "{topic.title}"' if topic else ''
        if cert_earned:
            headline = f"You passed the final exam{step_ref} and earned your certificate!"
        elif topic and topic.is_final_exam and not passed:
            headline = f"You scored {score}/100 on the final exam{step_ref} — you need {topic.mastery_threshold} to pass. Try again."
        elif unlocked:
            headline = f"You scored {score}/100{step_ref} — the next step is now unlocked."
        elif topic and not passed:
            headline = f"You scored {score}/100{step_ref} — you need {topic.mastery_threshold} to pass. Try again."
        else:
            headline = f"You scored {score}/100{step_ref}."
        message = headline + (f" Feedback: {feedback}" if feedback else "")
        db.session.add(Notification(
            user_id     = student.id,
            title       = "Certificate earned!" if cert_earned else "Your submission was graded",
            message     = message,
            type        = "grade",
            entity_type = "submission",
            entity_id   = str(submission.id),
        ))

    db.session.commit()
    return success(
        {**submission.to_dict(), "unlocked": unlocked, "cert_earned": cert_earned},
        f"✅ Score {score} applied."
    )