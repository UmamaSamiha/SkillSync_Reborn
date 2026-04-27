"""
SkillSync — Engagement Engine
==============================
Calculates weekly engagement scores for a student from raw activity data.

SCORES (each 0–100, then weighted into total):
  forum_score      — forum_post actions this week        weight 25 %
  submission_score — actual submissions this week         weight 35 %
  resource_score   — resource_access actions this week   weight 20 %
  quiz_score       — quiz_attempt actions this week       weight 20 %

NORMALIZATION (how raw counts become 0–100):
  forum      : count × 20   (5 posts  → 100)
  submission : count × 50   (2 subs   → 100)
  resource   : count × 10   (10 views → 100)
  quiz       : count × 25   (4 tries  → 100)

All capped at 100. Total is weighted average of the four.
"""

from datetime import datetime, timezone, timedelta

from sqlalchemy import func

from app import db
from app.models import ActivityLog, EngagementScore, Submission, SubmissionStatus

# ── Weights ───────────────────────────────────────────────────────
WEIGHTS = {
    "forum":      0.25,
    "submission": 0.35,
    "resource":   0.20,
    "quiz":       0.20,
}

# ── How many raw actions = 100 points ─────────────────────────────
CAPS = {
    "forum":      5,   # 5 forum posts  → 100
    "submission": 2,   # 2 submissions  → 100
    "resource":   10,  # 10 resource views → 100
    "quiz":       4,   # 4 quiz attempts → 100
}


def _normalize(count: int, cap: int) -> float:
    """Turn a raw count into a 0–100 float."""
    return min(round((count / cap) * 100.0, 2), 100.0)


def _week_start_for(date=None):
    """Return Monday of the week containing `date` (defaults to today UTC)."""
    if date is None:
        date = datetime.now(timezone.utc).date()
    return date - timedelta(days=date.weekday())


def calculate_engagement(
    user_id: str,
    project_id: str = None,
    week_start=None,          # pass a date object to back-fill old weeks
) -> dict:
    """
    Calculate (or recalculate) one student's engagement for one week.
    Upserts the EngagementScore row and returns a summary dict.

    Parameters
    ----------
    user_id    : UUID string of the student
    project_id : optional — filter activity to one project
    week_start : date of Monday of the target week (defaults to current week)

    Returns
    -------
    dict with keys: forum_score, submission_score, resource_score,
                    quiz_score, total_score, week_start
    """
    if week_start is None:
        week_start = _week_start_for()

    week_end = week_start + timedelta(days=7)

    # ── Base activity log query ──────────────────────────────────
    def _log_count(action_type: str) -> int:
        q = ActivityLog.query.filter(
            ActivityLog.user_id  == user_id,
            ActivityLog.action_type == action_type,
            func.date(ActivityLog.timestamp) >= week_start,
            func.date(ActivityLog.timestamp) <  week_end,
        )
        if project_id:
            q = q.filter(ActivityLog.project_id == project_id)
        return q.count()

    # ── Count raw events ─────────────────────────────────────────
    forum_count    = _log_count("forum_post")
    resource_count = _log_count("resource_access")
    quiz_count     = _log_count("quiz_attempt")

    # Submissions come from the Submission table (more reliable than logs)
    sub_q = Submission.query.filter(
        Submission.student_id == user_id,
        Submission.status.in_([
            SubmissionStatus.SUBMITTED,
            SubmissionStatus.GRADED,
            SubmissionStatus.LATE,
        ]),
        Submission.submitted_at != None,
        func.date(Submission.submitted_at) >= week_start,
        func.date(Submission.submitted_at) <  week_end,
    )
    submission_count = sub_q.count()

    # ── Normalize to 0–100 ───────────────────────────────────────
    forum_score      = _normalize(forum_count,      CAPS["forum"])
    submission_score = _normalize(submission_count, CAPS["submission"])
    resource_score   = _normalize(resource_count,   CAPS["resource"])
    quiz_score       = _normalize(quiz_count,       CAPS["quiz"])

    # ── Weighted total ───────────────────────────────────────────
    total_score = round(
        forum_score      * WEIGHTS["forum"]      +
        submission_score * WEIGHTS["submission"]  +
        resource_score   * WEIGHTS["resource"]    +
        quiz_score       * WEIGHTS["quiz"],
        2,
    )

    # ── Upsert EngagementScore row ───────────────────────────────
    record = EngagementScore.query.filter_by(
        user_id    = user_id,
        project_id = project_id,
        week_start = week_start,
    ).first()

    if record:
        record.forum_score      = forum_score
        record.submission_score = submission_score
        record.resource_score   = resource_score
        record.quiz_score       = quiz_score
        record.total_score      = total_score
        record.calculated_at    = datetime.now(timezone.utc)
    else:
        record = EngagementScore(
            user_id          = user_id,
            project_id       = project_id,
            week_start       = week_start,
            forum_score      = forum_score,
            submission_score = submission_score,
            resource_score   = resource_score,
            quiz_score       = quiz_score,
            total_score      = total_score,
        )
        db.session.add(record)

    db.session.commit()

    return {
        "week_start":       str(week_start),
        "forum_score":      forum_score,
        "submission_score": submission_score,
        "resource_score":   resource_score,
        "quiz_score":       quiz_score,
        "total_score":      total_score,
        # raw counts included so callers can show breakdowns
        "_raw": {
            "forum_posts":    forum_count,
            "submissions":    submission_count,
            "resource_views": resource_count,
            "quiz_attempts":  quiz_count,
        },
    }


def calculate_all_engagement(project_id: str = None) -> list:
    """
    Recalculate current-week engagement for every active student.
    Returns list of result dicts (one per student).
    """
    from app.models import User, Role  # local import avoids circular

    students = User.query.filter_by(role=Role.STUDENT, is_active=True).all()
    results  = []

    for student in students:
        try:
            result = calculate_engagement(student.id, project_id=project_id)
            results.append({
                "user_id":   student.id,
                "full_name": student.full_name,
                "email":     student.email,
                **result,
            })
        except Exception as exc:
            results.append({
                "user_id":   student.id,
                "full_name": student.full_name,
                "error":     str(exc),
            })

    return results