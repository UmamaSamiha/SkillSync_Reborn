"""
SkillSync — Risk Engine Service
================================
Calculates and persists a RiskProfile for a given student.
Flags: low attendance, falling grades, late submissions.
"""
from datetime import datetime, timezone, timedelta
from app import db
from app.models import RiskProfile, GradeRecord, Submission, SubmissionStatus, RiskLevel, ActivityLog


def recalculate_risk(user_id: str) -> RiskProfile:
    """
    Recalculate risk profile for a student.
    Returns the updated (or newly created) RiskProfile.
    """
    profile = RiskProfile.query.filter_by(user_id=user_id).first()
    if not profile:
        profile = RiskProfile(user_id=user_id)
        db.session.add(profile)

    flags       = []
    risk_points = 0

    # ── Attendance score (based on activity logs last 14 days) ────────────
    since = datetime.now(timezone.utc) - timedelta(days=14)
    activity_count = ActivityLog.query.filter(
        ActivityLog.user_id == user_id,
        ActivityLog.timestamp >= since
    ).count()

    # 50 activities in 14 days = 100% attendance
    attendance_score = round(min(100.0, (activity_count / 50) * 100), 1)
    profile.attendance_score = attendance_score

    if attendance_score < 40:
        flags.append("low_attendance")
        risk_points += 2
    elif attendance_score < 60:
        risk_points += 1

    # ── Grade trend ────────────────────────────────────────────────────────
    records = (
        GradeRecord.query
        .filter_by(user_id=user_id)
        .order_by(GradeRecord.recorded_at.asc())
        .all()
    )

    if records:
        percentages = [r.percentage for r in records]
        avg         = sum(percentages) / len(percentages)

        # Trend: compare first half vs second half
        mid   = len(percentages) // 2
        first = sum(percentages[:mid]) / max(mid, 1)
        last  = sum(percentages[mid:]) / max(len(percentages) - mid, 1)

        if last > first + 5:
            trend = "rising"
        elif last < first - 5:
            trend = "falling"
            flags.append("falling_grades")
            risk_points += 2
        else:
            trend = "stable"

        profile.grade_trend = trend

        # Low average
        if avg < 50:
            flags.append("low_grades")
            risk_points += 3

        # Predict final grade using linear extrapolation
        if len(percentages) >= 3:
            n           = len(percentages)
            x_mean      = (n - 1) / 2
            y_mean      = avg
            numerator   = sum((i - x_mean) * (p - y_mean) for i, p in enumerate(percentages))
            denominator = sum((i - x_mean) ** 2 for i in range(n)) or 1
            slope       = numerator / denominator
            profile.predicted_grade = round(min(max(percentages[-1] + slope * 3, 0), 100), 1)

    # ── Late submissions ───────────────────────────────────────────────────
    late_count = Submission.query.filter_by(
        student_id=user_id,
        is_late=True
    ).count()

    profile.late_submission_count = late_count

    if late_count >= 3:
        flags.append("frequent_late_submissions")
        risk_points += 2
    elif late_count >= 1:
        risk_points += 1

    # ── Missing submissions ────────────────────────────────────────────────
    total_submitted = Submission.query.filter_by(
        student_id=user_id
    ).filter(Submission.status != SubmissionStatus.DRAFT).count()

    if total_submitted == 0:
        flags.append("no_submissions")
        risk_points += 3

    # ── Final risk level ───────────────────────────────────────────────────
    if risk_points >= 5:
        profile.risk_level = RiskLevel.HIGH
    elif risk_points >= 2:
        profile.risk_level = RiskLevel.MEDIUM
    else:
        profile.risk_level = RiskLevel.LOW

    profile.flags           = flags
    profile.last_calculated = datetime.now(timezone.utc)

    db.session.commit()
    return profile