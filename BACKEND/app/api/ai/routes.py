"""
SkillSync — AI Blueprint
=========================
Three endpoints:
  GET  /api/ai/member-detail/<user_id>  — aggregated member data for MemberDetail page
  POST /api/ai/member-insight           — Claude-generated insight text for a member
  POST /api/ai/session-summary          — Claude-generated productivity summary for History page
"""

import os
import random
from collections import defaultdict

from flask import Blueprint, request
from flask_jwt_extended import jwt_required
import google.generativeai as genai

from app import db
from app.models import (
    User, ActivityLog, EngagementScore,
    Submission, Assignment, RiskProfile, FocusSession, SubmissionScan
)
from app.utils.helpers import success, error, get_current_user

ai_bp = Blueprint("ai", __name__)

def _gemini():
    genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
    return genai.GenerativeModel("gemini-1.5-flash")


# ── colour / text maps for activity feed ─────────────────────────────────────

ACTION_COLOR = {
    "file_upload":     "#5E6623",
    "submission":      "#893941",
    "focus_session":   "#893941",
    "forum_post":      "#CB7885",
    "quiz_attempt":    "#CB7885",
    "resource_access": "#D4D994",
}

ACTION_LABEL = {
    "file_upload":     "Uploaded a file",
    "submission":      "Submitted an assignment",
    "focus_session":   "Completed a focus session",
    "forum_post":      "Posted in the forum",
    "quiz_attempt":    "Attempted a quiz",
    "resource_access": "Accessed a resource",
}


# ── 1. GET /api/ai/member-detail/<user_id> ─────────────────────────────────

@ai_bp.route("/member-detail/<user_id>", methods=["GET"])
@jwt_required()
def member_detail(user_id):
    """
    Aggregates contribution breakdown + recent activity + status for
    the MemberDetail page.  Admin / teacher only.
    """
    current = get_current_user()
    if not current or current.role not in ("admin", "teacher"):
        return error("Forbidden", 403)

    user = User.query.get(user_id)
    if not user:
        return error("User not found", 404)

    # ── contribution breakdown ────────────────────────────────────────────────
    score = (
        EngagementScore.query
        .filter_by(user_id=user_id)
        .order_by(EngagementScore.calculated_at.desc())
        .first()
    )

    if score:
        raw = {
            "file_upload":   score.resource_score,
            "comments":      score.submission_score,
            "forum_posts":   score.forum_score,
            "quiz_attempts": score.quiz_score,
        }
    else:
        logs = ActivityLog.query.filter_by(user_id=user_id).all()
        counts = defaultdict(int)
        for log in logs:
            counts[log.action_type] += 1
        raw = {
            "file_upload":   counts.get("file_upload", 0),
            "comments":      counts.get("submission", 0),
            "forum_posts":   counts.get("forum_post", 0),
            "quiz_attempts": counts.get("quiz_attempt", 0),
        }

    total = sum(raw.values()) or 1
    contribution = {k: round(v / total * 100) for k, v in raw.items()}

    # ── recent activity (last 4 entries) ─────────────────────────────────────
    logs = (
        ActivityLog.query
        .filter_by(user_id=user_id)
        .order_by(ActivityLog.timestamp.desc())
        .limit(4)
        .all()
    )

    recent_activity = []
    for log in logs:
        extra = log.extra_data or {}
        text  = (
            extra.get("description")
            or extra.get("topic")
            or ACTION_LABEL.get(log.action_type,
                                log.action_type.replace("_", " ").title())
        )
        recent_activity.append({
            "id":    log.id,
            "date":  log.timestamp.strftime("%b %-d, %Y"),
            "color": ACTION_COLOR.get(log.action_type, "#7A7063"),
            "text":  text,
        })

    # ── status (from risk profile or is_active) ───────────────────────────────
    risk = RiskProfile.query.filter_by(user_id=user_id).first()
    if risk and risk.risk_level == "high":
        status = "At Risk"
    elif not user.is_active:
        status = "Inactive"
    else:
        status = "Active"

    # ── modules_done (submitted / total assignments) ──────────────────────────
    submitted     = Submission.query.filter_by(student_id=user_id).count()
    total_assigns = Assignment.query.count()
    modules_done  = f"{min(submitted, total_assigns)}/{total_assigns}" if total_assigns else "0/0"

    return success({
        "status":          status,
        "modules_done":    modules_done,
        "contribution":    contribution,
        "recent_activity": recent_activity,
    })


# ── 2. POST /api/ai/member-insight ───────────────────────────────────────────

@ai_bp.route("/member-insight", methods=["POST"])
@jwt_required()
def member_insight():
    """
    Accepts member_data from the frontend and returns a Claude-generated
    insight + recommendation for the instructor.  Admin / teacher only.
    """
    current = get_current_user()
    if not current or current.role not in ("admin", "teacher"):
        return error("Forbidden", 403)

    data        = request.get_json(silent=True) or {}
    member_data = data.get("member_data", {})

    if not member_data:
        return error("member_data is required", 400)

    prompt = (
        "You are an academic performance advisor reviewing a student's engagement data.\n\n"
        f"Student: {member_data.get('full_name', 'Unknown')}\n"
        f"Status: {member_data.get('status', 'Unknown')}\n"
        f"Modules completed: {member_data.get('modules_done', 'N/A')}\n"
        f"Last active: {member_data.get('last_active', 'Unknown')}\n"
        f"Contribution breakdown: {member_data.get('contribution', {})}\n\n"
        "Write 2–3 concise sentences summarising this student's engagement pattern "
        "followed by one specific, actionable recommendation for the instructor. "
        "Be direct and practical."
    )

    try:
        insight = _gemini().generate_content(prompt).text
    except Exception as exc:
        return error(f"AI service error: {exc}", 502)

    return success({"insight": insight})


# ── 3. POST /api/ai/session-summary ──────────────────────────────────────────

@ai_bp.route("/session-summary", methods=["POST"])
@jwt_required()
def session_summary():
    """
    Accepts sessions + stats from the frontend and returns a Claude-generated
    productivity summary and study tip for the History page.
    """
    data     = request.get_json(silent=True) or {}
    sessions = data.get("sessions", [])
    stats    = data.get("stats", {})

    if not sessions:
        return error("sessions list is required", 400)

    # Aggregate topic minutes
    topics: dict[str, int] = {}
    for s in sessions:
        t = s.get("topic_label") or "General"
        topics[t] = topics.get(t, 0) + int(s.get("duration_minutes", 0))

    top_topics = sorted(topics.items(), key=lambda x: x[1], reverse=True)[:3]
    topic_str  = ", ".join(f"{t} ({m} min)" for t, m in top_topics)

    total_mins   = stats.get("total_minutes", 0)
    hours, mins  = divmod(total_mins, 60)

    prompt = (
        "You are a study productivity coach reviewing a student's focus session history.\n\n"
        f"Total focus time: {hours}h {mins}m\n"
        f"Sessions completed: {stats.get('sessions_completed', len(sessions))}\n"
        f"Current streak: {stats.get('streak', 0)} days\n"
        f"Top topics: {topic_str}\n\n"
        "Write exactly two sentences: first, a motivating observation about their study "
        "pattern; second, one concrete tip to improve their productivity. "
        "Be encouraging but specific."
    )

    try:
        summary = _gemini().generate_content(prompt).text
    except Exception as exc:
        return error(f"AI service error: {exc}", 502)

    return success({"summary": summary})

# ── 4. POST /api/ai/scan/<submission_id> ─────────────────────────────────────

@ai_bp.route("/scan/<int:submission_id>", methods=["POST"])
@jwt_required()
def scan_submission(submission_id):
    """
    Triggers an AI & similarity detection scan for a specific submission.
    Admin / teacher only.
    """
    current = get_current_user()
    if not current or current.role not in ("admin", "teacher"):
        return error("Forbidden", 403)

    submission = Submission.query.get(submission_id)
    if not submission:
        return error("Submission not found", 404)

    content = submission.content or ""
    if not content.strip():
        return error("Submission has no text content to scan", 400)

    try:
        from app.services_ai_detection import analyze_submission, compute_similarity

        # ── AI detection via Claude + heuristics ─────────────────────────────
        analysis = analyze_submission(content, use_claude=True)

        # ── Similarity check against other submissions for same assignment ───
        other_submissions = (
            Submission.query
            .filter(
                Submission.assignment_id == submission.assignment_id,
                Submission.id != submission_id,
            )
            .all()
        )

        max_similarity = 0.0
        for other in other_submissions:
            if other.content:
                sim = compute_similarity(content, other.content)
                if sim > max_similarity:
                    max_similarity = sim

        similarity_score = round(max_similarity * 100, 2)

        # ── Save result ───────────────────────────────────────────────────────
        existing = SubmissionScan.query.filter_by(submission_id=submission_id).first()
        if existing:
            existing.ai_score         = analysis["ai_score"]
            existing.similarity_score = similarity_score
            existing.status           = "completed"
        else:
            db.session.add(SubmissionScan(
                submission_id    = submission_id,
                ai_score         = analysis["ai_score"],
                similarity_score = similarity_score,
                status           = "completed",
            ))

        # Flag submission if AI score is high
        if analysis["flagged"]:
            submission.flagged = True

        db.session.commit()

        return success({
            "submission_id":    submission_id,
            "ai_score":         analysis["ai_score"],
            "heuristic_score":  analysis["heuristic_score"],
            "claude_score":     analysis["claude_score"],
            "similarity_score": similarity_score,
            "confidence":       analysis["confidence"],
            "reason":           analysis["reason"],
            "flagged":          analysis["flagged"],
            "status":           "completed",
        })

    except Exception as exc:
        db.session.rollback()
        return error(f"Scanning failed: {exc}", 500)