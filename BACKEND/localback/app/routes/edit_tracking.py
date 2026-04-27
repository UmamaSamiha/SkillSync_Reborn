import os
from datetime import datetime, timezone
from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from app import db
from app.models import User, Role, Topic, UserTopicProgress, TopicPrerequisite
from app.utils.helpers import success, error, get_current_user

edit_tracking_bp = Blueprint("edit_tracking", __name__)


class Submission(db.Model):
    __tablename__ = "submissions"

    id            = db.Column(db.Integer, primary_key=True)
    user_id       = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title         = db.Column(db.String(255), nullable=False)
    content_type  = db.Column(db.String(50), nullable=False, default="quiz")
    topic_name    = db.Column(db.String(255), nullable=True)
    topic_id      = db.Column(db.Integer, db.ForeignKey("topics.id"), nullable=True)
    final_text    = db.Column(db.Text, nullable=True)
    ai_score      = db.Column(db.Float, nullable=True)
    ai_flagged    = db.Column(db.Boolean, default=False)
    teacher_score = db.Column(db.Integer, nullable=True)
    scored_by     = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    scored_at     = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at    = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at    = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    edits  = db.relationship("EditEvent", backref="submission", lazy=True, cascade="all, delete-orphan")
    user   = db.relationship("User", foreign_keys=[user_id], backref="submissions", lazy=True)
    scorer = db.relationship("User", foreign_keys=[scored_by], lazy=True)

    def to_dict(self):
        return {
            "id":            self.id,
            "user_id":       self.user_id,
            "user_name":     self.user.full_name if self.user else None,
            "user_email":    self.user.email if self.user else None,
            "title":         self.title,
            "content_type":  self.content_type,
            "topic_name":    self.topic_name,
            "final_text":    self.final_text,
            "ai_score":      self.ai_score,
            "ai_flagged":    self.ai_flagged,
            "teacher_score": self.teacher_score,
            "scored_by":     self.scorer.full_name if self.scorer else None,
            "scored_at":     self.scored_at.isoformat() if self.scored_at else None,
            "created_at":    self.created_at.isoformat() if self.created_at else None,
            "updated_at":    self.updated_at.isoformat() if self.updated_at else None,
            "edit_count":    len(self.edits),
        }


class EditEvent(db.Model):
    __tablename__ = "edit_events"

    id            = db.Column(db.Integer, primary_key=True)
    submission_id = db.Column(db.Integer, db.ForeignKey("submissions.id"), nullable=False)
    text_snapshot = db.Column(db.Text, nullable=False)
    chars_added   = db.Column(db.Integer, nullable=False, default=0)
    chars_removed = db.Column(db.Integer, nullable=False, default=0)
    is_paste      = db.Column(db.Boolean, default=False)
    created_at    = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id":            self.id,
            "submission_id": self.submission_id,
            "text_snapshot": self.text_snapshot,
            "chars_added":   self.chars_added,
            "chars_removed": self.chars_removed,
            "is_paste":      self.is_paste,
            "created_at":    self.created_at.isoformat() if self.created_at else None,
        }


def _recompute_unlock(user_id: int):
    all_topics = Topic.query.all()
    mastered_ids = {
        p.topic_id
        for p in UserTopicProgress.query.filter_by(
            user_id=user_id, status="mastered"
        ).all()
    }

    for topic in all_topics:
        prog = UserTopicProgress.query.filter_by(
            user_id=user_id, topic_id=topic.id
        ).first()

        if not prog:
            prog = UserTopicProgress(
                user_id=user_id, topic_id=topic.id, status="locked"
            )
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
        submission = Submission.query.filter_by(
            id=sub_id, user_id=user.id
        ).first()
        if not submission:
            return error("Submission not found", 404)
    else:
        submission = Submission(
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

    event = EditEvent(
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
    if not user or user.role not in (Role.ADMIN, Role.TEACHER):
        return error("Admin or Teacher access required", 403)

    submissions = Submission.query.order_by(
        Submission.updated_at.desc()
    ).all()
    return success([s.to_dict() for s in submissions])


@edit_tracking_bp.route("/submission/<int:sub_id>", methods=["GET"])
@jwt_required()
def get_submission(sub_id):
    user = get_current_user()
    if not user or user.role not in (Role.ADMIN, Role.TEACHER):
        return error("Admin or Teacher access required", 403)

    submission = Submission.query.get(sub_id)
    if not submission:
        return error("Submission not found", 404)

    events = (
        EditEvent.query
        .filter_by(submission_id=sub_id)
        .order_by(EditEvent.created_at.asc())
        .all()
    )

    return success({
        **submission.to_dict(),
        "timeline": [e.to_dict() for e in events],
    })


@edit_tracking_bp.route("/submission/<int:sub_id>/score", methods=["POST"])
@jwt_required()
def score_submission(sub_id):
    user = get_current_user()
    if not user or user.role not in (Role.ADMIN, Role.TEACHER):
        return error("Admin or Teacher access required", 403)

    submission = Submission.query.get(sub_id)
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
        topic = Topic.query.get(submission.topic_id)
        if topic and score >= topic.mastery_threshold:
            prog = UserTopicProgress.query.filter_by(
                user_id=student.id, topic_id=topic.id
            ).first()
            if not prog:
                prog = UserTopicProgress(
                    user_id=student.id, topic_id=topic.id, status="locked"
                )
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
        {
            **submission.to_dict(),
            "unlocked":   unlocked,
            "user_email": student.email if student else None,
            "user_name":  student.full_name if student else None,
        },
        f"✅ Score {score} applied to submission."
    )