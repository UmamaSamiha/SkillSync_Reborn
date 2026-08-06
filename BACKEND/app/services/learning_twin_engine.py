"""
SkillSync — AI Learning Twin Engine
=====================================
Builds a per-student learning profile from signals already collected
elsewhere in the app — nothing here is tracked live, it's all derived:

  - Curriculum topic mastery (AnushkaUserTopicProgress/AnushkaTopic)
      -> strengths, weaknesses, forgetting patterns, revision needed
  - GradeRecord history + RiskProfile
      -> pace, confidence level
  - ActivityLog action-type distribution
      -> preferred learning style
  - TimeLog timestamps
      -> best study times

The structured signals are then handed to Gemini to produce a short
narrative summary and concrete recommendations. If Gemini is unavailable,
everything above still works — only the free-text summary degrades to a
template built from the same structured data.
"""
import os
import json
import re
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timezone

from app import db
from app.models import (
    LearningProfile, AnushkaUserTopicProgress, AnushkaTopic,
    GradeRecord, RiskProfile, Submission, ActivityLog, TimeLog,
)

PROFILE_MAX_AGE_HOURS = 24


# ── Topic mastery: strengths / weaknesses / forgetting / revision ─────────────

def _topic_signals(user_id: str):
    rows = (
        db.session.query(AnushkaUserTopicProgress, AnushkaTopic)
        .join(AnushkaTopic, AnushkaUserTopicProgress.topic_id == AnushkaTopic.id)
        .filter(AnushkaUserTopicProgress.user_id == user_id)
        .all()
    )

    strengths, weaknesses, forgetting, revision = [], [], [], []

    for progress, topic in rows:
        entry_base = {"track": topic.track, "title": topic.title}

        if progress.status == "mastered" and progress.quiz_score is not None:
            strengths.append({**entry_base, "mastery_score": progress.quiz_score})
            if progress.attempts >= 3:
                forgetting.append({**entry_base, "attempts": progress.attempts})
            elif progress.quiz_score < topic.mastery_threshold + 5:
                # Passed, but barely — fragile mastery worth another pass
                revision.append({**entry_base, "reason": f"Barely passed ({progress.quiz_score}%) — worth reviewing"})

        elif progress.status in ("in_progress", "unlocked") and progress.quiz_score is not None:
            gap = topic.mastery_threshold - progress.quiz_score
            entry = {**entry_base, "reason": f"Scored {progress.quiz_score}% (needs {topic.mastery_threshold}%)"}
            weaknesses.append({**entry, "_gap": gap})
            revision.append(entry)

    strengths.sort(key=lambda x: x["mastery_score"], reverse=True)
    weaknesses.sort(key=lambda x: x["_gap"], reverse=True)
    for w in weaknesses:
        w.pop("_gap", None)

    return {
        "strengths":   strengths[:5],
        "weaknesses":  weaknesses[:5],
        "forgetting":  forgetting[:5],
        "revision":    revision[:5],
        "topics_seen": len(rows),
    }


# ── Pace + confidence: grade history & risk profile ───────────────────────────

def _pace_and_confidence(user_id: str, topic_signals: dict):
    records = (
        GradeRecord.query.filter_by(user_id=user_id)
        .order_by(GradeRecord.recorded_at.asc()).all()
    )
    risk = RiskProfile.query.filter_by(user_id=user_id).first()

    # Confidence: how consistent are their scores?
    confidence = None
    if len(records) >= 3:
        percentages = [r.percentage for r in records]
        avg   = sum(percentages) / len(percentages)
        spread = statistics.pstdev(percentages)
        if spread < 10 and avg >= 65:
            confidence = "high"
        elif spread < 18:
            confidence = "medium"
        else:
            confidence = "low"
    elif risk and risk.risk_level:
        confidence = {"low": "medium", "medium": "medium", "high": "low"}.get(risk.risk_level)

    # Pace: how many tries does it take them to master a topic, and are they late often?
    mastered = [t for t in topic_signals["strengths"]]
    forgetting_count = len(topic_signals["forgetting"])
    late_count = Submission.query.filter_by(student_id=user_id, is_late=True).count()
    submitted_count = Submission.query.filter(
        Submission.student_id == user_id, Submission.status != "draft"
    ).count()
    late_ratio = (late_count / submitted_count) if submitted_count else 0

    pace = None
    if mastered or submitted_count:
        struggle_ratio = (forgetting_count / len(mastered)) if mastered else 0
        if struggle_ratio < 0.2 and late_ratio < 0.15:
            pace = "fast"
        elif struggle_ratio < 0.5 and late_ratio < 0.4:
            pace = "steady"
        else:
            pace = "slow"

    return {
        "confidence_level": confidence,
        "pace":              pace,
        "grade_trend":       risk.grade_trend if risk else None,
        "predicted_grade":   risk.predicted_grade if risk else None,
        "late_ratio":        round(late_ratio, 2),
    }


# ── Learning style: what kind of activity dominates ───────────────────────────

STYLE_LABELS = {
    "resource_access": ("Reader & Researcher", "You tend to review materials and resources before diving in."),
    "quiz_attempt":    ("Practice-Driven",      "You learn best by testing yourself through quizzes and practice."),
    "forum_post":      ("Collaborative",        "You engage with peers and discussion to work through ideas."),
    "submission":      ("Hands-On Builder",     "You learn by doing — building and submitting work directly."),
    "file_upload":      ("Hands-On Builder",     "You learn by doing — building and submitting work directly."),
}

def _learning_style(user_id: str):
    logs = ActivityLog.query.filter_by(user_id=user_id).all()
    counts = Counter(l.action_type for l in logs if l.action_type in STYLE_LABELS)

    if not counts:
        return {"learning_style": None, "learning_style_note": None, "activity_points": 0}

    total = sum(counts.values())
    top_type, top_count = counts.most_common(1)[0]
    share = top_count / total

    if share < 0.35:
        label, note = "Balanced / Multimodal", "You mix reading, practice, discussion, and hands-on work fairly evenly."
    else:
        label, note = STYLE_LABELS[top_type]

    return {"learning_style": label, "learning_style_note": note, "activity_points": total}


# ── Best study times: when do they actually log time/activity? ───────────────

TIME_BUCKETS = [
    (5, 8,   "early mornings"),
    (8, 12,  "mornings"),
    (12, 17, "afternoons"),
    (17, 21, "evenings"),
    (21, 24, "late nights"),
    (0, 5,   "late nights"),
]

def _bucket_for_hour(hour: int) -> str:
    for start, end, label in TIME_BUCKETS:
        if start <= hour < end:
            return label
    return "evenings"

def _best_study_times(user_id: str):
    logs = TimeLog.query.filter_by(user_id=user_id).all()
    if len(logs) < 3:
        return []

    minutes_by_bucket = defaultdict(int)
    weekday_minutes, weekend_minutes = 0, 0
    for log in logs:
        bucket = _bucket_for_hour(log.created_at.hour if log.created_at else 18)
        minutes_by_bucket[bucket] += log.minutes
        if log.logged_at and log.logged_at.weekday() >= 5:
            weekend_minutes += log.minutes
        else:
            weekday_minutes += log.minutes

    top_buckets = sorted(minutes_by_bucket.items(), key=lambda x: x[1], reverse=True)[:2]
    day_type = "weekends" if weekend_minutes > weekday_minutes * 1.3 else "weekdays"

    return [f"{day_type.capitalize()}, {bucket}" for bucket, _ in top_buckets]


# ── Gemini narrative + recommendations ────────────────────────────────────────

def _gemini_narrative(user_name: str, signals: dict):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")

        prompt = f"""You are an academic coach building a personalized "Learning Twin" summary for a student named {user_name}, based on real usage data from their learning platform.

Data:
{json.dumps(signals, indent=2, default=str)}

Write:
1. "summary": 2-3 sentences in second person ("You...") describing their learning profile — strengths, pace, confidence, and style. Encouraging but honest.
2. "recommendations": exactly 3-4 short, specific, actionable recommendations (each under 20 words) based on the data — e.g. what to revisit, when to study, how to use their style.

Return ONLY this JSON, no extra text:
{{"summary": "...", "recommendations": ["...", "...", "..."]}}"""

        raw = model.generate_content(prompt).text.strip()
        if raw.startswith("```"):
            raw = re.sub(r"```[a-z]*\n?", "", raw).strip("` \n")
        result = json.loads(raw)
        if "summary" in result and "recommendations" in result:
            return result
    except Exception:
        pass
    return None


def _template_narrative(user_name: str, signals: dict):
    """Fallback when Gemini is unavailable — built from the same structured signals."""
    parts = []
    pace = signals.get("pace_confidence", {}).get("pace")
    confidence = signals.get("pace_confidence", {}).get("confidence_level")
    style = signals.get("learning_style", {}).get("learning_style")

    if pace:
        parts.append(f"You're moving through material at a {pace} pace")
    if confidence:
        parts.append(f"with {confidence} confidence based on your recent scores")
    if style:
        parts.append(f"and you learn best as a {style.lower()}")

    summary = (", ".join(parts) + "." if parts else
               "Keep using SkillSync — once you've logged a bit more activity, your profile will get much sharper.")
    summary = summary[0].upper() + summary[1:] if summary else summary

    recs = []
    weaknesses = signals.get("topics", {}).get("weaknesses", [])
    forgetting = signals.get("topics", {}).get("forgetting", [])
    best_times = signals.get("best_study_times", [])

    if weaknesses:
        recs.append(f"Revisit \"{weaknesses[0]['title']}\" — {weaknesses[0]['reason'].lower()}")
    if forgetting:
        recs.append(f"Do a quick refresh on \"{forgetting[0]['title']}\" — it took a few attempts to master")
    if best_times:
        recs.append(f"You tend to focus best on {best_times[0].lower()} — block that time out")
    if not recs:
        recs.append("Complete a few more assignments and quizzes to unlock personalized recommendations")

    return {"summary": summary, "recommendations": recs}


# ── Orchestration ──────────────────────────────────────────────────────────────

def compute_profile(user_id: str) -> LearningProfile:
    from app.models import User
    user = User.query.get(user_id)

    topic_signals = _topic_signals(user_id)
    pace_conf     = _pace_and_confidence(user_id, topic_signals)
    style         = _learning_style(user_id)
    best_times    = _best_study_times(user_id)

    data_points = (
        topic_signals["topics_seen"]
        + style["activity_points"]
        + (10 if pace_conf["grade_trend"] else 0)
        + len(best_times)
    )

    signals = {
        "topics":          {k: v for k, v in topic_signals.items() if k != "topics_seen"},
        "pace_confidence": pace_conf,
        "learning_style":  {"learning_style": style["learning_style"]},
        "best_study_times": best_times,
    }

    narrative = None
    if user:
        narrative = _gemini_narrative(user.full_name, signals)
    if not narrative:
        narrative = _template_narrative(user.full_name if user else "there", signals)

    profile = LearningProfile.query.filter_by(user_id=user_id).first()
    if not profile:
        profile = LearningProfile(user_id=user_id)
        db.session.add(profile)

    profile.strengths           = topic_signals["strengths"]
    profile.weaknesses          = topic_signals["weaknesses"]
    profile.forgetting_patterns = topic_signals["forgetting"]
    profile.revision_needed     = topic_signals["revision"]
    profile.learning_style      = style["learning_style"]
    profile.learning_style_note = style["learning_style_note"]
    profile.pace                = pace_conf["pace"]
    profile.confidence_level    = pace_conf["confidence_level"]
    profile.best_study_times    = best_times
    profile.ai_summary          = narrative["summary"]
    profile.ai_recommendations  = narrative["recommendations"]
    profile.data_points         = data_points
    profile.computed_at         = datetime.now(timezone.utc)

    db.session.commit()
    return profile


def get_or_compute_profile(user_id: str, force: bool = False) -> LearningProfile:
    profile = LearningProfile.query.filter_by(user_id=user_id).first()
    if profile and not force:
        age_hours = (datetime.now(timezone.utc) - profile.computed_at).total_seconds() / 3600
        if age_hours < PROFILE_MAX_AGE_HOURS:
            return profile
    return compute_profile(user_id)
