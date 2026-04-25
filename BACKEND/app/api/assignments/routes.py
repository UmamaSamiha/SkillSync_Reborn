"""
SkillSync — Assignments API
============================
CRUD for assignments, submissions with edit history tracking,
group assignment management, and topic prerequisite enforcement.
"""

from datetime import datetime, timezone
from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required

from app import db
from app.models import (
    Assignment, Submission, SubmissionStatus,
    EditHistory, Topic, ActivityLog, Notification,
    AssignmentGroup, GroupMembership, User, Role
)
from app.utils.helpers import (
    success, error, paginate, get_current_user,
    teacher_or_admin, allowed_file, save_upload, validate_required
)
from app.services.ai_detection import check_ai_similarity

assignments_bp = Blueprint("assignments", __name__)


# ── GET /api/assignments ──────────────────────────────────────────────────────

@assignments_bp.route("/", methods=["GET"])
@jwt_required()
def list_assignments():
    query      = Assignment.query
    project_id = request.args.get("project_id")
    topic_id   = request.args.get("topic_id")

    if project_id:
        query = query.filter_by(project_id=project_id)
    if topic_id:
        query = query.filter_by(topic_id=topic_id)

    result = paginate(
        query.order_by(Assignment.due_date.asc()),
        lambda a: a.to_dict()
    )
    return success(result)


# ── POST /api/assignments ─────────────────────────────────────────────────────

@assignments_bp.route("/", methods=["POST"])
@jwt_required()
@teacher_or_admin
def create_assignment():
    data    = request.get_json(silent=True) or {}
    missing = validate_required(data, ["project_id", "title"])
    if missing:
        return error(f"Missing: {', '.join(missing)}", 400)

    user = get_current_user()
    due_date = None
    if data.get("due_date"):
        try:
            due_date = datetime.fromisoformat(data["due_date"])
        except ValueError:
            return error("Invalid due_date format. Use ISO 8601.", 400)

    assignment = Assignment(
        project_id  = data["project_id"],
        topic_id    = data.get("topic_id"),
        created_by  = user.id,
        title       = data["title"].strip(),
        description = data.get("description", ""),
        due_date    = due_date,
        max_score   = float(data.get("max_score", 100)),
        difficulty  = data.get("difficulty", "intermediate"),
        allow_late  = bool(data.get("allow_late", False)),
        is_group    = bool(data.get("is_group", False)),
    )
    db.session.add(assignment)
    db.session.flush()

    _notify_project_members(
        assignment.project_id,
        title       = f"New assignment: {assignment.title}",
        message     = f"A new assignment has been posted: {assignment.title}",
        type        = "deadline",
        entity_type = "assignment",
        entity_id   = assignment.id,
    )

    db.session.commit()
    return success(assignment.to_dict(), "Assignment created", 201)


# ── GET /api/assignments/<id> ─────────────────────────────────────────────────

@assignments_bp.route("/<assignment_id>", methods=["GET"])
@jwt_required()
def get_assignment(assignment_id):
    a = Assignment.query.get_or_404(assignment_id)
    data = a.to_dict()
    data["submission_count"] = a.submissions.count()
    return success(data)


# ── PUT /api/assignments/<id> ─────────────────────────────────────────────────

@assignments_bp.route("/<assignment_id>", methods=["PUT"])
@jwt_required()
@teacher_or_admin
def update_assignment(assignment_id):
    a    = Assignment.query.get_or_404(assignment_id)
    data = request.get_json(silent=True) or {}

    if "title"       in data: a.title       = data["title"].strip()
    if "description" in data: a.description = data["description"]
    if "max_score"   in data: a.max_score   = float(data["max_score"])
    if "difficulty"  in data: a.difficulty  = data["difficulty"]
    if "allow_late"  in data: a.allow_late  = bool(data["allow_late"])
    if "is_group"    in data: a.is_group    = bool(data["is_group"])
    if "due_date"    in data:
        a.due_date = datetime.fromisoformat(data["due_date"]) if data["due_date"] else None

    db.session.commit()
    return success(a.to_dict(), "Assignment updated")


# ── DELETE /api/assignments/<id> ──────────────────────────────────────────────

@assignments_bp.route("/<assignment_id>", methods=["DELETE"])
@jwt_required()
@teacher_or_admin
def delete_assignment(assignment_id):
    a = Assignment.query.get_or_404(assignment_id)
    db.session.delete(a)
    db.session.commit()
    return success(None, "Assignment deleted")


# ═══════════════════════════════════════════════════════
# GROUP MANAGEMENT
# ═══════════════════════════════════════════════════════

@assignments_bp.route("/<assignment_id>/groups", methods=["GET"])
@jwt_required()
def list_groups(assignment_id):
    """List all groups for a group assignment."""
    Assignment.query.get_or_404(assignment_id)
    groups = AssignmentGroup.query.filter_by(assignment_id=assignment_id).all()
    return success([g.to_dict() for g in groups])


@assignments_bp.route("/<assignment_id>/groups", methods=["POST"])
@jwt_required()
@teacher_or_admin
def create_group(assignment_id):
    """
    Create a student group for a group assignment.
    Body: { student_ids: [uuid, ...] }
    """
    assignment = Assignment.query.get_or_404(assignment_id)
    if not assignment.is_group:
        return error("Assignment is not a group assignment", 400)

    data        = request.get_json(silent=True) or {}
    student_ids = data.get("student_ids", [])
    if not student_ids:
        return error("student_ids is required", 400)

    group = AssignmentGroup(assignment_id=assignment_id)
    db.session.add(group)
    db.session.flush()

    for sid in student_ids:
        student = User.query.get(sid)
        if not student:
            continue
        existing = GroupMembership.query.filter_by(
            group_id=group.id, student_id=sid
        ).first()
        if not existing:
            db.session.add(GroupMembership(group_id=group.id, student_id=sid))

    # Create one shared draft submission owned by first student
    first_id = student_ids[0]
    submission = Submission(
        assignment_id = assignment_id,
        student_id    = first_id,
        group_id      = group.id,
        status        = SubmissionStatus.DRAFT,
    )
    db.session.add(submission)

    # Notify each group member
    for sid in student_ids:
        db.session.add(Notification(
            user_id     = sid,
            title       = f"Group assigned: {assignment.title}",
            message     = f"You have been added to a group for '{assignment.title}'.",
            type        = "info",
            entity_type = "assignment",
            entity_id   = assignment_id,
        ))

    db.session.commit()
    return success(group.to_dict(), "Group created", 201)


# ═══════════════════════════════════════════════════════
# SUBMISSIONS
# ═══════════════════════════════════════════════════════

@assignments_bp.route("/<assignment_id>/submissions", methods=["GET"])
@jwt_required()
def list_submissions(assignment_id):
    """List submissions. Teacher sees all; students see own."""
    user  = get_current_user()
    query = Submission.query.filter_by(assignment_id=assignment_id)

    if user.role == "student":
        # Find group submission if in a group, else own submission
        membership = (
            GroupMembership.query
            .join(AssignmentGroup)
            .filter(
                AssignmentGroup.assignment_id == assignment_id,
                GroupMembership.student_id == user.id,
            ).first()
        )
        if membership:
            query = query.filter_by(group_id=membership.group_id)
        else:
            query = query.filter_by(student_id=user.id)

    result = paginate(query, lambda s: {
        **s.to_dict(),
        "student":      s.student.to_dict() if user.role != "student" else None,
        "group_members": _get_group_members(s.group_id) if s.group_id else None,
    })
    return success(result)


@assignments_bp.route("/<assignment_id>/submissions", methods=["POST"])
@jwt_required()
def submit_assignment(assignment_id):
    """Submit or update a draft submission. Group members share one submission."""
    user       = get_current_user()
    assignment = Assignment.query.get_or_404(assignment_id)
    now        = datetime.now(timezone.utc)

    # ── Prerequisite check ─────────────────────────────────────────────────
    if assignment.topic_id:
        topic = Topic.query.get(assignment.topic_id)
        if topic and topic.prerequisite_id:
            try:
                _check_prerequisite(user.id, topic.prerequisite_id, assignment.project_id)
            except PermissionError as e:
                return error(str(e), 403)

    # ── Find or create submission ──────────────────────────────────────────
    submission = None

    if assignment.is_group:
        # Check if student is in a group for this assignment
        membership = (
            GroupMembership.query
            .join(AssignmentGroup)
            .filter(
                AssignmentGroup.assignment_id == assignment_id,
                GroupMembership.student_id == user.id,
            ).first()
        )
        if membership:
            submission = Submission.query.filter_by(group_id=membership.group_id).first()

    if not submission:
        submission = Submission.query.filter_by(
            assignment_id=assignment_id,
            student_id=user.id
        ).first()

    if not submission:
        submission = Submission(
            assignment_id=assignment_id,
            student_id=user.id,
            status=SubmissionStatus.DRAFT
        )
        db.session.add(submission)
        db.session.flush()

    # ── Handle JSON content ────────────────────────────────────────────────
    data        = request.get_json(silent=True) or {}
    new_content = data.get("content", submission.content or "")

    # ── Edit history & paste detection ─────────────────────────────────────
    if new_content and new_content != submission.content:
        old_len    = len(submission.content or "")
        new_len    = len(new_content)
        char_delta = new_len - old_len
        large_paste = char_delta > current_app.config["AI_LARGE_PASTE_THRESHOLD"]

        version = submission.edit_history.count() + 1
        hist = EditHistory(
            submission_id    = submission.id,
            user_id          = user.id,
            content_snapshot = new_content,
            char_delta       = char_delta,
            is_large_paste   = large_paste,
            version_number   = version,
        )
        db.session.add(hist)
        submission.content = new_content

        if large_paste:
            submission.flagged = True

    # ── Final submit ───────────────────────────────────────────────────────
    if data.get("submit") in [True, "true", "1"]:
        due = assignment.due_date
        if due and due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
        is_late = bool(due and now > due)
        submission.status       = SubmissionStatus.SUBMITTED
        submission.submitted_at = now
        submission.is_late      = is_late

        if submission.content:
            ai_score = check_ai_similarity(submission.content)
            submission.ai_score = ai_score
            if ai_score > current_app.config["AI_SIMILARITY_THRESHOLD"]:
                submission.flagged = True

        db.session.add(ActivityLog(
            user_id=user.id, project_id=assignment.project_id,
            action_type="submission", entity_type="assignment",
            entity_id=assignment_id,
        ))

        # Notify teachers of the submission
        teachers = User.query.filter_by(role=Role.TEACHER, is_active=True).all()
        for teacher in teachers:
            db.session.add(Notification(
                user_id     = teacher.id,
                title       = f"New submission: {assignment.title}",
                message     = f"{user.full_name} submitted '{assignment.title}'.",
                type        = "submission",
                entity_type = "assignment",
                entity_id   = assignment_id,
            ))

    db.session.commit()
    return success(submission.to_dict(), "Submission saved", 200)


# ── GET /api/assignments/submissions/<id>/history ────────────────────────────

@assignments_bp.route("/submissions/<submission_id>/history", methods=["GET"])
@jwt_required()
def edit_history(submission_id):
    user       = get_current_user()
    submission = Submission.query.get_or_404(submission_id)

    if user.role == "student" and submission.student_id != user.id:
        return error("Forbidden", 403)

    history = submission.edit_history.order_by(EditHistory.version_number).all()
    return success([h.to_dict() for h in history])


# ── PUT /api/assignments/submissions/<id>/grade ───────────────────────────────

@assignments_bp.route("/submissions/<submission_id>/grade", methods=["PUT"])
@jwt_required()
@teacher_or_admin
def grade_submission(submission_id):
    user       = get_current_user()
    submission = Submission.query.get_or_404(submission_id)
    data       = request.get_json(silent=True) or {}

    if "score" not in data:
        return error("Score is required", 400)

    score      = float(data["score"])
    assignment = submission.assignment

    if score < 0 or score > assignment.max_score:
        return error(f"Score must be between 0 and {assignment.max_score}", 400)

    submission.score     = score
    submission.feedback  = data.get("feedback", "")
    submission.status    = SubmissionStatus.GRADED
    submission.graded_at = datetime.now(timezone.utc)
    submission.graded_by = user.id

    # Notify student (and all group members)
    recipients = [submission.student_id]
    if submission.group_id:
        recipients = [m.student_id for m in
                      GroupMembership.query.filter_by(group_id=submission.group_id).all()]

    for uid in recipients:
        db.session.add(Notification(
            user_id    = uid,
            title      = "Assignment graded",
            message    = f'Your submission for "{assignment.title}" received {score}/{assignment.max_score}.',
            type       = "grade",
            entity_type= "submission",
            entity_id  = submission.id,
        ))

    db.session.commit()
    return success(submission.to_dict(), "Submission graded")


# ── HELPERS ───────────────────────────────────────────────────────────────────

def _get_group_members(group_id):
    if not group_id:
        return None
    return [
        {"user_id": m.student_id, "full_name": m.student.full_name}
        for m in GroupMembership.query.filter_by(group_id=group_id).all()
    ]


def _check_prerequisite(user_id, prerequisite_topic_id, project_id):
    from app.models import Submission, Assignment, Topic
    topic = Topic.query.get(prerequisite_topic_id)
    if not topic:
        return

    graded = (
        db.session.query(Submission)
        .join(Assignment)
        .filter(
            Assignment.topic_id == prerequisite_topic_id,
            Submission.student_id == user_id,
            Submission.status == SubmissionStatus.GRADED,
        )
        .all()
    )

    if not graded:
        raise PermissionError("Complete the prerequisite topic first")

    avg = sum(s.score / s.assignment.max_score * 100 for s in graded) / len(graded)
    if avg < topic.mastery_score:
        raise PermissionError(
            f"Achieve {topic.mastery_score}% mastery in '{topic.title}' to unlock this topic"
        )


def _notify_project_members(project_id, **kwargs):
    from app.models import ProjectMember
    members = ProjectMember.query.filter_by(project_id=project_id, is_active=True).all()
    for m in members:
        db.session.add(Notification(user_id=m.user_id, **kwargs))
