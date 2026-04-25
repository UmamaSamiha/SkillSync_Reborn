"""
SkillSync — Heatmap API
========================
Team collaboration heatmap: activity grid per member,
contribution share, and inactive member alerts.
"""

from datetime import datetime, timezone, timedelta, date
from collections import defaultdict

from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from app import db
from app.models import ActivityLog, ProjectMember, User, Notification
from app.utils.helpers import success, error, get_current_user

heatmap_bp = Blueprint("heatmap", __name__)


# ── GET /api/heatmap/<project_id> ─────────────────────────────────────────────

@heatmap_bp.route("/<project_id>", methods=["GET"])
@jwt_required()
def project_heatmap(project_id):
    """
    Return 7-day activity grid per member + contribution share.
    Query: ?days=7 (default 7, max 30)
    """
    days_back  = min(int(request.args.get("days", 7)), 30)
    cutoff     = datetime.now(timezone.utc) - timedelta(days=days_back)
    today      = datetime.now(timezone.utc).date()

    members = ProjectMember.query.filter_by(project_id=project_id, is_active=True).all()

    # Activity logs for the project in the window
    logs = ActivityLog.query.filter(
        ActivityLog.project_id == project_id,
        ActivityLog.timestamp  >= cutoff,
    ).all()

    # Build grid: {user_id: {date: count}}
    grid = defaultdict(lambda: defaultdict(int))
    for log in logs:
        day_key = log.timestamp.date().isoformat()
        grid[log.user_id][day_key] += 1

    # Build date column labels
    date_cols = [(today - timedelta(days=i)).isoformat() for i in range(days_back - 1, -1, -1)]

    member_rows = []
    total_by_member = {}
    for m in members:
        row = {
            "user":        m.user.to_dict(),
            "activity":    {d: grid[m.user_id].get(d, 0) for d in date_cols},
            "total":       sum(grid[m.user_id].values()),
        }
        member_rows.append(row)
        total_by_member[m.user_id] = row["total"]

    grand_total = sum(total_by_member.values()) or 1

    # Contribution share
    contribution_share = []
    for m in members:
        contribution_share.append({
            "user":       m.user.to_dict(),
            "total":      total_by_member[m.user_id],
            "percentage": round(total_by_member[m.user_id] / grand_total * 100, 1),
        })
    contribution_share.sort(key=lambda x: x["total"], reverse=True)

    # Detect inactive members (0 activity in window)
    inactive_threshold = int(request.args.get("inactive_days", 5))
    inactive_cutoff    = datetime.now(timezone.utc) - timedelta(days=inactive_threshold)
    inactive_members   = []
    for m in members:
        last_log = (
            ActivityLog.query
            .filter_by(user_id=m.user_id, project_id=project_id)
            .order_by(ActivityLog.timestamp.desc())
            .first()
        )
        if not last_log or last_log.timestamp < inactive_cutoff:
            inactive_members.append(m.user.to_dict())

    # Most active day of week across all members
    day_totals = defaultdict(int)
    for log in logs:
        day_name = log.timestamp.strftime("%A")
        day_totals[day_name] += 1
    most_active_day = max(day_totals, key=day_totals.get) if day_totals else "N/A"

    return success({
        "date_cols":          date_cols,
        "members":            member_rows,
        "contribution_share": contribution_share,
        "inactive_members":   inactive_members,
        "stats": {
            "active_members":  len(members) - len(inactive_members),
            "total_members":   len(members),
            "total_actions":   sum(total_by_member.values()),
            "most_active_day": most_active_day,
        },
    })


# ── POST /api/heatmap/<project_id>/notify-inactive ───────────────────────────

@heatmap_bp.route("/<project_id>/notify-inactive", methods=["POST"])
@jwt_required()
def notify_inactive(project_id):
    """Send notifications to inactive members."""
    from app.utils.helpers import teacher_or_admin
    user    = get_current_user()
    if user.role not in ["admin", "teacher"]:
        return error("Forbidden", 403)

    inactive_days = int(request.args.get("inactive_days", 5))
    cutoff        = datetime.now(timezone.utc) - timedelta(days=inactive_days)

    members  = ProjectMember.query.filter_by(project_id=project_id, is_active=True).all()
    notified = []

    for m in members:
        last_log = (
            ActivityLog.query
            .filter_by(user_id=m.user_id, project_id=project_id)
            .order_by(ActivityLog.timestamp.desc())
            .first()
        )
        if not last_log or last_log.timestamp < cutoff:
            n = Notification(
                user_id    = m.user_id,
                title      = "You've been inactive",
                message    = f"You haven't contributed to the project in {inactive_days}+ days. Get back on track!",
                type       = "system",
                entity_type= "project",
                entity_id  = project_id,
            )
            db.session.add(n)
            notified.append(m.user.full_name)

    db.session.commit()
    return success({"notified": notified}, f"Notified {len(notified)} inactive members")