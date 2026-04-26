"""
SkillSync — Analytics API
==========================
Performance trends, weekly productivity, contribution breakdown,
engagement scores, and per-topic time analytics.
"""

from datetime import datetime, timezone, timedelta
from collections import defaultdict

from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from app import db
from app.models import (
    User, FocusSession, ActivityLog, EngagementScore,
    Submission, GradeRecord, ProjectMember, Assignment
)
from app.utils.helpers import success, error, get_current_user

analytics_bp = Blueprint("analytics", __name__)


# ── PERMISSION CHECK ──────────────────────────────────────────────

def _check_access(current, user_id: str) -> bool:
    """
    FIX: user_id is UUID string throughout.
    Admin can access anyone; student can only access self.
    """
    if not current:
        return False
    if str(current.role) == "admin":
        return True
    if str(current.role) == "student":
        return str(current.id) == str(user_id)
    # teacher: allow all
    return True


# ── PERFORMANCE ───────────────────────────────────────────────────

@analytics_bp.route("/performance/<user_id>", methods=["GET"])
@jwt_required()
def performance_trends(user_id):
    current = get_current_user()

    # FIX: user_id is UUID string — no int conversion
    if not user_id:
        return error("Invalid user_id", 400)

    if not _check_access(current, user_id):
        return error("Forbidden", 403)

    records = (
        GradeRecord.query
        .filter_by(user_id=user_id)
        .order_by(GradeRecord.recorded_at.asc())
        .all()
    )

    trend = [
        {
            "date":       r.recorded_at.isoformat(),
            "score":      r.score,
            "max_score":  r.max_score,
            "percentage": round(r.percentage, 2),
        }
        for r in records
    ]

    percentages = [r.percentage for r in records]
    avg = round(sum(percentages) / len(percentages), 2) if percentages else 0

    trend_direction = "stable"
    if len(percentages) >= 2:
        trend_direction = (
            "rising"  if percentages[-1] > percentages[0]  else
            "falling" if percentages[-1] < percentages[0]  else
            "stable"
        )

    return success({
        "trend":             trend,
        "average":           avg,
        "trend_direction":   trend_direction,
        "total_submissions": len(records),
    })


# ── WEEKLY PRODUCTIVITY ───────────────────────────────────────────

@analytics_bp.route("/weekly-productivity/<user_id>", methods=["GET"])
@jwt_required()
def weekly_productivity(user_id):
    current = get_current_user()

    if not _check_access(current, user_id):
        return error("Forbidden", 403)

    today      = datetime.now(timezone.utc).date()
    week_start = today - timedelta(days=today.weekday())

    sessions = FocusSession.query.filter(
        FocusSession.user_id == user_id,
        func.date(FocusSession.started_at) >= week_start,
        func.date(FocusSession.started_at) <= week_start + timedelta(days=6),
    ).all()

    daily = defaultdict(float)
    for s in sessions:
        daily[str(s.started_at.date())] += s.duration_minutes / 60

    days = []
    for i in range(7):
        d  = week_start + timedelta(days=i)
        ds = str(d)
        days.append({
            "date":  ds,
            "day":   d.strftime("%a"),
            "hours": round(daily.get(ds, 0), 2),
        })

    return success({
        "days":        days,
        "total_hours": round(sum(x["hours"] for x in days), 2),
        "week_start":  str(week_start),
    })


# ── CONTRIBUTION ──────────────────────────────────────────────────

@analytics_bp.route("/contribution/<project_id>", methods=["GET"])
@jwt_required()
def contribution_breakdown(project_id):
    members = ProjectMember.query.filter_by(project_id=project_id, is_active=True).all()

    action_types  = ["file_upload", "submission", "forum_post", "quiz_attempt", "resource_access"]
    total_actions = 0
    result        = []

    for m in members:
        logs = ActivityLog.query.filter_by(
            user_id=m.user_id, project_id=project_id
        ).all()

        counts = defaultdict(int)
        for log in logs:
            if log.action_type in action_types:
                counts[log.action_type] += 1

        total = sum(counts.values())
        total_actions += total

        result.append({
            "user":          m.user.to_dict(),
            "counts":        dict(counts),
            "total_actions": total,
        })

    for r in result:
        r["percentage"] = round(
            (r["total_actions"] / total_actions * 100) if total_actions else 0, 1
        )

    result.sort(key=lambda x: x["total_actions"], reverse=True)

    return success({"members": result, "total_actions": total_actions})


# ── ENGAGEMENT ────────────────────────────────────────────────────

@analytics_bp.route("/engagement/<user_id>", methods=["GET"])
@jwt_required()
def engagement_score(user_id):
    current = get_current_user()

    if not _check_access(current, user_id):
        return error("Forbidden", 403)

    scores = EngagementScore.query.filter_by(user_id=user_id).all()

    return success({
        "history": [s.to_dict() for s in scores],
        "current": scores[-1].to_dict() if scores else {
            "forum_score": 0, "submission_score": 0,
            "resource_score": 0, "quiz_score": 0, "total_score": 0,
        }
    })


# ── TOPIC TIME ────────────────────────────────────────────────────

@analytics_bp.route("/topic-time/<user_id>", methods=["GET"])
@jwt_required()
def topic_time_breakdown(user_id):
    current = get_current_user()

    if not _check_access(current, user_id):
        return error("Forbidden", 403)

    sessions  = FocusSession.query.filter_by(user_id=user_id).all()
    by_topic  = defaultdict(float)

    for s in sessions:
        by_topic[s.topic_label or "General"] += s.duration_minutes / 60

    topics = sorted(
        [{"topic": k, "hours": round(v, 2)} for k, v in by_topic.items()],
        key=lambda x: x["hours"], reverse=True
    )

    return success({"topics": topics})


# ── SUMMARY ───────────────────────────────────────────────────────

@analytics_bp.route("/summary/<user_id>", methods=["GET"])
@jwt_required()
def user_summary(user_id):
    current = get_current_user()

    if not _check_access(current, user_id):
        return error("Forbidden", 403)

    total_minutes = db.session.query(
        func.sum(FocusSession.duration_minutes)
    ).filter_by(user_id=user_id).scalar() or 0

    submissions = Submission.query.filter_by(student_id=user_id).count()

    grades  = GradeRecord.query.filter_by(user_id=user_id).all()
    avg_grade = round(
        sum(g.percentage for g in grades) / len(grades), 1
    ) if grades else 0

    streak = _calc_streak(user_id)

    return success({
        "total_focus_hours":  round(total_minutes / 60, 1),
        "total_submissions":  submissions,
        "average_grade":      avg_grade,
        "focus_streak_days":  streak,
    })


# ── GRADE PREDICTION ──────────────────────────────────────────────

@analytics_bp.route("/grade-prediction/<user_id>", methods=["GET"])
@jwt_required()
def grade_prediction(user_id):
    """
    Returns predicted final grade based on current trend.
    Uses the same linear extrapolation as risk_engine.
    """
    current = get_current_user()

    if not _check_access(current, user_id):
        return error("Forbidden", 403)

    records = (
        GradeRecord.query
        .filter_by(user_id=user_id)
        .order_by(GradeRecord.recorded_at.asc())
        .all()
    )

    if not records:
        return success({"predicted_grade": None, "confidence": "low", "data_points": 0})

    percentages = [r.percentage for r in records]
    avg         = sum(percentages) / len(percentages)

    predicted = avg  # fallback
    if len(percentages) >= 3:
        n          = len(percentages)
        x_mean     = (n - 1) / 2
        y_mean     = avg
        numerator  = sum((i - x_mean) * (p - y_mean) for i, p in enumerate(percentages))
        denominator= sum((i - x_mean) ** 2 for i in range(n)) or 1
        slope      = numerator / denominator
        predicted  = round(min(max(percentages[-1] + slope * 3, 0), 100), 1)

    confidence = "high" if len(percentages) >= 5 else "medium" if len(percentages) >= 3 else "low"

    return success({
        "predicted_grade": predicted,
        "current_average": round(avg, 1),
        "confidence":      confidence,
        "data_points":     len(percentages),
        "letter_grade":    _letter_grade(predicted),
    })


# ── STUDENT PERFORMANCE OVERVIEW (admin) ──────────────────────────

@analytics_bp.route("/all-students-performance", methods=["GET"])
@jwt_required()
def all_students_performance():
    """
    Admin/teacher endpoint: returns performance summary for every student.
    """
    current = get_current_user()
    if not current or str(current.role) not in ["admin", "teacher"]:
        return error("Forbidden", 403)

    students = User.query.filter_by(role="student", is_active=True).all()
    result   = []

    for s in students:
        grades = GradeRecord.query.filter_by(user_id=s.id).all()
        percentages = [g.percentage for g in grades]
        avg = round(sum(percentages) / len(percentages), 1) if percentages else 0

        trend_direction = "stable"
        if len(percentages) >= 2:
            trend_direction = (
                "rising"  if percentages[-1] > percentages[0] else
                "falling" if percentages[-1] < percentages[0] else
                "stable"
            )

        result.append({
            "user":              s.to_dict(),
            "average":           avg,
            "trend_direction":   trend_direction,
            "total_submissions": len(grades),
        })

    return success(result)


# ── HELPERS ───────────────────────────────────────────────────────

def _calc_streak(user_id: str) -> int:
    today  = datetime.now(timezone.utc).date()
    streak = 0

    while True:
        count = FocusSession.query.filter(
            FocusSession.user_id == user_id,
            func.date(FocusSession.started_at) == today,
        ).count()

        if count == 0:
            break

        streak += 1
        today  -= timedelta(days=1)

    return streak


def _letter_grade(avg: float) -> str:
    if avg >= 90: return "A+"
    if avg >= 85: return "A"
    if avg >= 80: return "A-"
    if avg >= 75: return "B+"
    if avg >= 70: return "B"
    if avg >= 65: return "B-"
    if avg >= 60: return "C+"
    if avg >= 55: return "C"
    return "F"