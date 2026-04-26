"""
SkillSync — Notifications API
==============================
Endpoints:
  GET    /api/notifications/              List current user's notifications
  GET    /api/notifications/unread-count  Lightweight count for bell icon
  PUT    /api/notifications/<id>/read     Mark one as read
  PUT    /api/notifications/read-all      Mark all as read
  DELETE /api/notifications/<id>          Delete a single notification
"""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from app import db
from app.models import Notification
from app.utils.helpers import success, error, get_current_user, paginate

notifications_bp = Blueprint("notifications", __name__)


# ── GET /api/notifications ────────────────────────────────────────────────────

@notifications_bp.route("/", methods=["GET"])
@jwt_required()
def list_notifications():
    user = get_current_user()
    if not user:
        return error("Unauthorized", 401)

    query = Notification.query.filter_by(user_id=user.id).order_by(
        Notification.created_at.desc()
    )

    if request.args.get("unread") in ["true", "1"]:
        query = query.filter_by(is_read=False)

    notif_type = request.args.get("type")
    if notif_type:
        query = query.filter_by(type=notif_type)

    result = paginate(query, lambda n: n.to_dict())
    result["unread_count"] = Notification.query.filter_by(
        user_id=user.id, is_read=False
    ).count()

    return success(result)


# ── GET /api/notifications/unread-count ──────────────────────────────────────

@notifications_bp.route("/unread-count", methods=["GET"])
@jwt_required()
def unread_count():
    user = get_current_user()
    if not user:
        return error("Unauthorized", 401)

    count = Notification.query.filter_by(user_id=user.id, is_read=False).count()
    return success({"unread_count": count})


# ── PUT /api/notifications/<id>/read ─────────────────────────────────────────

@notifications_bp.route("/<notification_id>/read", methods=["PUT"])
@jwt_required()
def mark_read(notification_id):
    user = get_current_user()
    n = Notification.query.get_or_404(notification_id)

    if n.user_id != user.id:
        return error("Forbidden", 403)

    if not n.is_read:
        n.is_read = True
        db.session.commit()

    return success(n.to_dict(), "Marked as read")


# ── PUT /api/notifications/read-all ──────────────────────────────────────────

@notifications_bp.route("/read-all", methods=["PUT"])
@jwt_required()
def mark_all_read():
    user = get_current_user()
    updated = Notification.query.filter_by(
        user_id=user.id, is_read=False
    ).update({"is_read": True})
    db.session.commit()
    return success({"updated": updated}, "All notifications marked as read")


# ── DELETE /api/notifications/<id> ───────────────────────────────────────────

@notifications_bp.route("/<notification_id>", methods=["DELETE"])
@jwt_required()
def delete_notification(notification_id):
    user = get_current_user()
    n = Notification.query.get_or_404(notification_id)

    if n.user_id != user.id:
        return error("Forbidden", 403)

    db.session.delete(n)
    db.session.commit()
    return success(None, "Notification deleted")
