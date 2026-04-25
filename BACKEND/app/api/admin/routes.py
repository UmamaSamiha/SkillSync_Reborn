"""
SkillSync — Admin API
======================
Admin-only: risk detection, AI/similarity flags,
student classification, engagement overview.
"""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from app.models import User, Submission, RiskProfile, GradeRecord, RiskLevel, FocusSession, Notification, Project, ProjectMember
from app.utils.helpers import success, error, admin_required, get_current_user
from app.services.risk_engine import recalculate_risk
from app import db
from sqlalchemy import func
import os
import requests

admin_bp = Blueprint("admin", __name__)


# ── GET /api/admin/overview ───────────────────────────────────────────────────
@admin_bp.route("/overview", methods=["GET"])
@jwt_required()
@admin_required
def admin_overview():
    total_students  = User.query.filter_by(role="student", is_active=True).count()
    total_teachers  = User.query.filter_by(role="teacher", is_active=True).count()
    flagged_count   = Submission.query.filter_by(flagged=True).count()
    high_risk_count = RiskProfile.query.filter_by(risk_level="high").count()
    pending_count   = User.query.filter_by(is_active=False).filter(
        User.role.in_(["student", "teacher"])
    ).count()

    return success({
        "total_students":  total_students,
        "total_teachers":  total_teachers,
        "flagged_count":   flagged_count,
        "high_risk_count": high_risk_count,
        "pending_count":   pending_count,
    })


# ── GET /api/admin/pending-users ──────────────────────────────────────────────
@admin_bp.route("/pending-users", methods=["GET"])
@jwt_required()
@admin_required
def pending_users():
    """Get all users pending approval."""
    users = User.query.filter_by(is_active=False).filter(
        User.role.in_(["student", "teacher"])
    ).order_by(User.created_at.desc()).all()

    return success([u.to_dict() for u in users])


# ── POST /api/admin/approve-user/<user_id> ────────────────────────────────────
@admin_bp.route("/approve-user/<user_id>", methods=["POST"])
@jwt_required()
@admin_required
def approve_user(user_id):
    """Approve a pending user account."""
    user = User.query.get_or_404(str(user_id))

    if user.is_active:
        return error("User is already active", 400)

    user.is_active = True
    db.session.flush()

    # Enroll student in all active projects (joined_at = now, so old assignments stay hidden)
    if user.role == "student":
        active_projects = Project.query.filter_by(is_active=True).all()
        for project in active_projects:
            already = ProjectMember.query.filter_by(
                project_id=project.id, user_id=user.id
            ).first()
            if not already:
                db.session.add(ProjectMember(
                    project_id=project.id,
                    user_id=user.id,
                    role_in_group="member",
                ))

    # Notify the user that their account is approved
    n = Notification(
        user_id     = user.id,
        title       = "Account Approved!",
        message     = f"Welcome to SkillSync, {user.full_name}! Your account has been approved. You can now login.",
        type        = "info",
        entity_type = "user",
        entity_id   = user.id,
    )
    db.session.add(n)
    db.session.commit()

    return success(user.to_dict(), f"{user.full_name}'s account approved")


# ── POST /api/admin/reject-user/<user_id> ─────────────────────────────────────
@admin_bp.route("/reject-user/<user_id>", methods=["POST"])
@jwt_required()
@admin_required
def reject_user(user_id):
    """Reject and delete a pending user account."""
    user = User.query.get_or_404(str(user_id))

    if user.is_active:
        return error("Cannot reject an already active user", 400)

    name = user.full_name
    db.session.delete(user)
    db.session.commit()

    return success(None, f"{name}'s registration rejected")


# ── GET /api/admin/flagged-submissions ────────────────────────────────────────
@admin_bp.route("/flagged-submissions", methods=["GET"])
@jwt_required()
@admin_required
def flagged_submissions():
    query  = Submission.query.filter_by(flagged=True).order_by(Submission.submitted_at.desc())
    result = []

    for s in query:
        result.append({
            **s.to_dict(),
            "student":          s.student.to_dict(),
            "assignment_title": s.assignment.title,
        })

    return success(result)


# ── GET /api/admin/risk-alerts ────────────────────────────────────────────────
@admin_bp.route("/risk-alerts", methods=["GET"])
@jwt_required()
@admin_required
def risk_alerts():
    profiles = RiskProfile.query.filter(
        RiskProfile.risk_level.in_([RiskLevel.MEDIUM, RiskLevel.HIGH])
    ).all()

    data = []
    for p in profiles:
        u        = p.user.to_dict()
        u["risk"] = {
            "risk_level":            p.risk_level,
            "grade_trend":           p.grade_trend or "stable",
            "attendance_score":      p.attendance_score or 0,
            "late_submission_count": p.late_submission_count or 0,
            "predicted_grade":       p.predicted_grade,
            "flags":                 p.flags or [],
        }
        data.append(u)

    return success(data)


# ── POST /api/admin/recalculate-risk/<user_id> ────────────────────────────────
@admin_bp.route("/recalculate-risk/<user_id>", methods=["POST"])
@jwt_required()
@admin_required
def recalc_risk(user_id):
    user = User.query.get_or_404(str(user_id))
    profile = recalculate_risk(user.id)
    return success(profile.to_dict(), "Risk profile recalculated")


# ── POST /api/admin/recalculate-all-risk ─────────────────────────────────────
@admin_bp.route("/recalculate-all-risk", methods=["POST"])
@jwt_required()
@admin_required
def recalc_all_risk():
    students = User.query.filter_by(role="student", is_active=True).all()
    updated  = []

    for s in students:
        try:
            profile = recalculate_risk(s.id)
            updated.append({
                "user_id":    s.id,
                "full_name":  s.full_name,
                "risk_level": profile.risk_level,
            })
        except Exception as e:
            updated.append({"user_id": s.id, "error": str(e)})

    return success({"updated": updated, "count": len(updated)}, "Risk profiles recalculated")


# ── POST /api/admin/send-risk-alerts ─────────────────────────────────────────
@admin_bp.route("/send-risk-alerts", methods=["POST"])
@jwt_required()
@admin_required
def send_risk_alerts():
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        return error("RESEND_API_KEY not configured in .env", 500)

    sender = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")

    profiles = RiskProfile.query.filter(
        RiskProfile.risk_level.in_([RiskLevel.MEDIUM, RiskLevel.HIGH])
    ).all()

    if not profiles:
        return success({"sent": 0}, "No at-risk students found")

    sent   = []
    failed = []

    for p in profiles:
        student = p.user
        if not student or not student.email:
            continue

        subject, html = _build_email(student, p)

        try:
            response = requests.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type":  "application/json",
                },
                json={
                    "from":    sender,
                    "to":      [student.email],
                    "subject": subject,
                    "html":    html,
                },
                timeout=10,
            )

            if response.status_code in [200, 201]:
                sent.append({"name": student.full_name, "email": student.email})
            else:
                failed.append({
                    "name":  student.full_name,
                    "email": student.email,
                    "error": response.text,
                })

        except Exception as e:
            failed.append({
                "name":  student.full_name,
                "email": student.email,
                "error": str(e),
            })

    return success({
        "sent":         sent,
        "failed":       failed,
        "sent_count":   len(sent),
        "failed_count": len(failed),
    }, f"Alerts sent to {len(sent)} students")


# ── GET /api/admin/student-classification ────────────────────────────────────
@admin_bp.route("/student-classification", methods=["GET"])
@jwt_required()
@admin_required
def student_classification():
    students = User.query.filter_by(role="student", is_active=True).all()
    result   = []

    for s in students:
        grades = GradeRecord.query.filter_by(user_id=s.id).all()
        avg    = (
            sum(g.percentage for g in grades) / len(grades)
            if grades else 0
        )

        risk        = s.risk_profile
        risk_level  = risk.risk_level  if risk else "low"
        grade_trend = risk.grade_trend if risk else "stable"

        total_minutes = db.session.query(
            func.sum(FocusSession.duration_minutes)
        ).filter_by(user_id=s.id).scalar() or 0

        result.append({
            "user":            s.to_dict(),
            "avg_grade":       round(avg, 1),
            "risk_level":      risk_level,
            "grade_trend":     grade_trend,
            "study_hours":     round(total_minutes / 60, 1),
            "classification":  _classify(avg, risk),
            "predicted_grade": risk.predicted_grade if risk else None,
            "flags":           risk.flags if risk else [],
        })

    return success(result)


@admin_bp.route("/personalized-feedback/<user_id>", methods=["GET"])
@jwt_required()
def personalized_feedback(user_id):
    current = get_current_user()
    if not current:
        return error("Unauthorized", 401)
    if current.role == "student" and str(current.id) != str(user_id):
        return error("Forbidden", 403)

    user = User.query.filter_by(id=str(user_id)).first()
    if not user:
        return error("Student not found", 404)

    grades = GradeRecord.query.filter_by(user_id=user_id).all()
    avg    = sum(g.percentage for g in grades) / len(grades) if grades else 0

    risk           = user.risk_profile
    classification = _classify(avg, risk)
    feedback       = _build_feedback(user.full_name, classification, risk, avg)

    return success({
        "user":           user.to_dict(),
        "classification": classification,
        "avg_grade":      round(avg, 1),
        "feedback":       feedback,
        "risk_level":     risk.risk_level if risk else "low",
        "flags":          risk.flags      if risk else [],
    })


# ── CLASSIFICATION ENGINE ─────────────────────────────────────────────────────

def _classify(avg: float, risk) -> str:
    if risk and risk.risk_level == "high":
        return "At-Risk"
    if risk and risk.grade_trend == "rising" and avg >= 60:
        return "Improving"
    if risk and risk.grade_trend == "falling":
        return "Declining"
    if avg >= 80:
        return "Consistent Performer"
    return "Average"


def _build_feedback(name: str, classification: str, risk, avg: float) -> dict:
    base = {
        "Consistent Performer": {
            "tone":    "encouraging",
            "summary": f"{name} is performing exceptionally well.",
            "message": f"Keep up the outstanding work! Your consistent performance at {avg:.1f}% shows dedication. Consider taking on more challenging topics or helping peers.",
            "actions": ["Explore advanced topics", "Mentor struggling peers", "Build portfolio projects"],
        },
        "Improving": {
            "tone":    "positive",
            "summary": f"{name} is showing strong upward momentum.",
            "message": f"Great progress! Your grades are trending upward. Stay consistent with your study schedule to consolidate these gains.",
            "actions": ["Maintain study routine", "Review earlier weak topics", "Track weekly goals"],
        },
        "Declining": {
            "tone":    "supportive",
            "summary": f"{name} needs attention — grades are falling.",
            "message": f"Your recent performance at {avg:.1f}% suggests you may need additional support. Let's identify what's causing the decline and address it together.",
            "actions": ["Schedule 1:1 with teacher", "Review missed assignments", "Increase focus sessions"],
        },
        "At-Risk": {
            "tone":    "urgent",
            "summary": f"{name} is at high risk and needs immediate intervention.",
            "message": f"Urgent attention needed. Multiple risk factors detected. Please reach out to your instructor immediately for a support plan.",
            "actions": ["Contact instructor today", "Catch up on late submissions", "Join study group"],
        },
        "Average": {
            "tone":    "neutral",
            "summary": f"{name} is performing at an average level.",
            "message": f"You're on track at {avg:.1f}%. A focused effort on weaker areas could significantly boost your grade.",
            "actions": ["Identify weak topics", "Increase study hours", "Complete all assignments on time"],
        },
    }

    result = base.get(classification, base["Average"]).copy()

    if risk and risk.flags:
        if "frequent_late_submissions" in risk.flags:
            result["actions"].append("Submit assignments before deadlines")
        if "falling_grades" in risk.flags:
            result["actions"].append("Review graded feedback carefully")
        if "no_submissions" in risk.flags:
            result["actions"].append("Submit pending assignments immediately")

    return result


# ── EMAIL BUILDER ─────────────────────────────────────────────────────────────

def _build_email(student, profile) -> tuple:
    risk_level  = profile.risk_level
    grade_trend = profile.grade_trend or "stable"
    late_count  = profile.late_submission_count or 0
    flags       = profile.flags or []

    trend_text = {
        "rising":  "Improving",
        "falling": "Declining",
        "stable":  "Stable",
    }.get(grade_trend, "Stable")

    if risk_level == "high":
        subject  = "⚠️ Urgent Academic Alert — Action Required | SkillSync"
        color    = "#DC2626"
        bg_color = "#FEE2E2"
        urgency  = "URGENT"
        intro    = "Our system has detected that you are currently at <b>high risk</b> academically. Immediate action is recommended."
    else:
        subject  = "📊 Academic Performance Alert | SkillSync"
        color    = "#C17B3A"
        bg_color = "#FEF3C7"
        urgency  = "ATTENTION NEEDED"
        intro    = "Our system has detected some concerns with your academic performance. Please review the details below."

    flags_html = "".join([
        f'<li style="margin-bottom:6px;color:#374151;">{f.replace("_", " ").title()}</li>'
        for f in flags
    ]) if flags else '<li style="color:#6B7280;">No specific flags</li>'

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E5E7EB;">
    <div style="background:#893941;padding:28px 32px;">
      <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:1px;">SkillSync</div>
      <div style="font-size:13px;color:#F5D0D3;margin-top:2px;">Academic Performance Alert</div>
    </div>
    <div style="background:{bg_color};padding:14px 32px;border-bottom:1px solid #E5E7EB;">
      <span style="background:{color};color:#fff;font-size:11px;font-weight:700;padding:3px 12px;border-radius:999px;letter-spacing:1px;">{urgency}</span>
    </div>
    <div style="padding:28px 32px;">
      <p style="font-size:16px;font-weight:600;color:#111827;margin:0 0 8px;">Dear {student.full_name},</p>
      <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 20px;">{intro}</p>
      <div style="background:#F9FAFB;border-radius:12px;padding:18px 20px;margin-bottom:20px;border:1px solid #E5E7EB;">
        <div style="font-size:12px;font-weight:700;color:#6B7280;margin-bottom:12px;letter-spacing:1px;">YOUR CURRENT STATUS</div>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#6B7280;">Risk Level</td>
            <td style="padding:6px 0;font-size:13px;font-weight:700;color:{color};text-align:right;">{risk_level.upper()}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#6B7280;">Grade Trend</td>
            <td style="padding:6px 0;font-size:13px;font-weight:600;color:#374151;text-align:right;">{trend_text}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#6B7280;">Late Submissions</td>
            <td style="padding:6px 0;font-size:13px;font-weight:600;color:#374151;text-align:right;">{late_count}</td>
          </tr>
          {f'<tr><td style="padding:6px 0;font-size:13px;color:#6B7280;">Predicted Grade</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#374151;text-align:right;">{profile.predicted_grade}%</td></tr>' if profile.predicted_grade else ''}
        </table>
      </div>
      <div style="margin-bottom:20px;">
        <div style="font-size:12px;font-weight:700;color:#6B7280;margin-bottom:8px;letter-spacing:1px;">DETECTED ISSUES</div>
        <ul style="margin:0;padding-left:20px;">{flags_html}</ul>
      </div>
      <div style="background:#F0FDF4;border-radius:12px;padding:16px 20px;border:1px solid #BBF7D0;margin-bottom:24px;">
        <div style="font-size:12px;font-weight:700;color:#166534;margin-bottom:8px;letter-spacing:1px;">RECOMMENDED ACTIONS</div>
        <ul style="margin:0;padding-left:20px;">
          <li style="font-size:13px;color:#374151;margin-bottom:5px;">Log in to SkillSync and review your pending assignments</li>
          <li style="font-size:13px;color:#374151;margin-bottom:5px;">Contact your instructor for academic support</li>
          <li style="font-size:13px;color:#374151;margin-bottom:5px;">Use the Focus Mode to increase your study hours</li>
          <li style="font-size:13px;color:#374151;">Submit any late or missing assignments as soon as possible</li>
        </ul>
      </div>
      <p style="font-size:13px;color:#6B7280;line-height:1.6;margin:0;">This is an automated alert from SkillSync. If you have questions, please contact your instructor directly.</p>
    </div>
    <div style="background:#F9FAFB;padding:18px 32px;border-top:1px solid #E5E7EB;text-align:center;">
      <p style="font-size:11px;color:#9CA3AF;margin:0;">SkillSync University Platform · Academic Performance Monitoring</p>
    </div>
  </div>
</body>
</html>"""

    return subject, html