"""
SkillSync — Time Logs API
==========================
POST /api/timelogs/                         Log time (student)
GET  /api/timelogs/weekly                   Weekly productivity for current user
GET  /api/timelogs/assignment/<id>/contributions  Per-member contribution (teacher/admin)
GET  /api/timelogs/                         Recent logs for current user
"""

from datetime import date, timedelta
from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from app import db
from app.models import (
    TimeLog, Assignment, Submission, EditHistory,
    ProjectMember, AssignmentGroup, GroupMembership, User
)
from app.utils.helpers import success, error, get_current_user, teacher_or_admin

timelogs_bp = Blueprint("timelogs", __name__)

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


@timelogs_bp.route("/", methods=["POST"])
@jwt_required()
def log_time():
    user = get_current_user()
    data = request.get_json(silent=True) or {}

    minutes = int(data.get("minutes", 0))
    if minutes <= 0:
        return error("minutes must be a positive integer", 400)

    log = TimeLog(
        user_id       = user.id,
        course_id     = data.get("course_id") or None,
        assignment_id = data.get("assignment_id") or None,
        description   = data.get("description", ""),
        minutes       = minutes,
        log_type      = data.get("log_type", "study"),
        logged_at     = date.today(),
    )
    db.session.add(log)
    db.session.commit()
    return success(log.to_dict(), "Time logged", 201)


@timelogs_bp.route("/", methods=["GET"])
@jwt_required()
def recent_logs():
    user = get_current_user()
    logs = (
        TimeLog.query
        .filter_by(user_id=user.id)
        .order_by(TimeLog.logged_at.desc(), TimeLog.created_at.desc())
        .limit(20)
        .all()
    )
    return success([l.to_dict() for l in logs])


@timelogs_bp.route("/weekly", methods=["GET"])
@jwt_required()
def weekly_productivity():
    user = get_current_user()

    today     = date.today()
    week_start = today - timedelta(days=today.weekday())  # Monday
    week_end   = week_start + timedelta(days=6)           # Sunday

    logs = TimeLog.query.filter(
        TimeLog.user_id  == user.id,
        TimeLog.logged_at >= week_start,
        TimeLog.logged_at <= week_end,
    ).all()

    # Build day buckets {0=Mon … 6=Sun}
    study_by_day      = {i: 0 for i in range(7)}
    assignment_by_day = {i: 0 for i in range(7)}

    for log in logs:
        day_idx = log.logged_at.weekday()
        if log.log_type == "assignment":
            assignment_by_day[day_idx] += log.minutes
        else:
            study_by_day[day_idx] += log.minutes

    # Total this week
    total_minutes = sum(l.minutes for l in logs)

    # Total last week for comparison
    last_week_start = week_start - timedelta(days=7)
    last_week_end   = week_start - timedelta(days=1)
    last_week_total = db.session.query(
        db.func.sum(TimeLog.minutes)
    ).filter(
        TimeLog.user_id   == user.id,
        TimeLog.logged_at >= last_week_start,
        TimeLog.logged_at <= last_week_end,
    ).scalar() or 0

    return success({
        "week_start":   week_start.isoformat(),
        "week_end":     week_end.isoformat(),
        "total_minutes": total_minutes,
        "last_week_minutes": last_week_total,
        "days": [
            {
                "label":      DAYS[i],
                "date":       (week_start + timedelta(days=i)).isoformat(),
                "study":      study_by_day[i],
                "assignment": assignment_by_day[i],
                "total":      study_by_day[i] + assignment_by_day[i],
            }
            for i in range(7)
        ],
    })


@timelogs_bp.route("/assignment/<assignment_id>/contributions", methods=["GET"])
@jwt_required()
def assignment_contributions(assignment_id):
    """
    Per-member contribution breakdown for a group assignment.

    Two paths:
    - Group submission (AssignmentGroup exists): contributions are tracked per
      editor via EditHistory.user_id on the shared submission — correctly splits
      among all group members regardless of who "owns" the submission row.
    - Individual submissions (no groups): each student owns their submission and
      their EditHistory, so student_id == editor.
    """
    user       = get_current_user()
    assignment = Assignment.query.get_or_404(assignment_id)
    is_faculty = user.role in ("teacher", "admin")

    members = []

    # ── Path A: assignment has formal groups (shared submissions) ─────────────
    groups = AssignmentGroup.query.filter_by(assignment_id=assignment_id).all()

    if groups:
        for group in groups:
            submission = Submission.query.filter_by(group_id=group.id).first()

            for membership in group.members.all():
                student = membership.student
                if not is_faculty and student.id != user.id:
                    continue

                # Chars: sum EditHistory entries authored by THIS student on the shared submission
                if submission:
                    history = EditHistory.query.filter_by(
                        submission_id=submission.id,
                        user_id=student.id,
                    ).all()
                    chars_written = sum(max(h.char_delta, 0) for h in history)
                    sub_status = submission.status
                    sub_score  = submission.score
                    is_late    = submission.is_late
                else:
                    chars_written = 0
                    sub_status    = None
                    sub_score     = None
                    is_late       = False

                time_spent = db.session.query(
                    db.func.sum(TimeLog.minutes)
                ).filter(
                    TimeLog.user_id       == student.id,
                    TimeLog.assignment_id == assignment_id,
                ).scalar() or 0

                members.append({
                    "user_id":            student.id,
                    "full_name":          student.full_name,
                    "chars_written":      chars_written,
                    "time_spent_minutes": time_spent,
                    "submission_status":  sub_status,
                    "score":              sub_score,
                    "is_late":            is_late,
                })

    else:
        # ── Path B: seeded/individual submissions (no formal groups) ──────────
        submissions = Submission.query.filter_by(assignment_id=assignment_id).all()

        for sub in submissions:
            if not is_faculty and sub.student_id != user.id:
                continue

            history = EditHistory.query.filter_by(submission_id=sub.id).all()
            chars_written = sum(max(h.char_delta, 0) for h in history)

            time_spent = db.session.query(
                db.func.sum(TimeLog.minutes)
            ).filter(
                TimeLog.user_id       == sub.student_id,
                TimeLog.assignment_id == assignment_id,
            ).scalar() or 0

            members.append({
                "user_id":            sub.student_id,
                "full_name":          sub.student.full_name if sub.student else "Unknown",
                "chars_written":      chars_written,
                "time_spent_minutes": time_spent,
                "submission_status":  sub.status,
                "score":              sub.score,
                "is_late":            sub.is_late,
            })

    members.sort(key=lambda m: m["chars_written"], reverse=True)

    total_chars = sum(m["chars_written"] for m in members) or 1
    for m in members:
        m["contribution_pct"] = round(m["chars_written"] / total_chars * 100, 1)

    return success({
        "assignment_id": assignment_id,
        "title":         assignment.title,
        "is_group":      assignment.is_group,
        "members":       members,
    })
