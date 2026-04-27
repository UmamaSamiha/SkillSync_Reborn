"""
SkillSync — Users API
======================
User profile management, project membership, avatar upload.
"""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from sqlalchemy.orm.attributes import flag_modified
from app import db
from app.models import User, Project, ProjectMember, Notification, RiskProfile, RiskLevel
from app.utils.helpers import (
    success, error, paginate, get_current_user,
    admin_required, teacher_or_admin, allowed_file, save_upload
)

users_bp = Blueprint("users", __name__)


# ── GET /api/users ────────────────────────────────────────────────────────────

@users_bp.route("/", methods=["GET"])
@jwt_required()
@teacher_or_admin
def list_users():
    """List all users (admin/teacher only). Supports ?role= filter."""
    query = User.query
    role = request.args.get("role")
    if role:
        query = query.filter_by(role=role)
    result = paginate(query.order_by(User.full_name), lambda u: u.to_dict())
    return success(result)


# ── GET /api/users/<id> ───────────────────────────────────────────────────────

@users_bp.route("/<user_id>", methods=["GET"])
@jwt_required()
def get_user(user_id):
    """Get a specific user's public profile."""
    current = get_current_user()
    user = User.query.get_or_404(user_id)



    if current.role == "student" and str(current.id) != str(user_id):
        if str(user.role) != "student":
            return error("Forbidden", 403)
    


    return success(user.to_dict())


# ── PUT /api/users/<id> ───────────────────────────────────────────────────────

@users_bp.route("/<user_id>", methods=["PUT"])
@jwt_required()
def update_user(user_id):
    """Update user profile (own profile or admin)."""
    current = get_current_user()
    if current.id != user_id and current.role != "admin":
        return error("Forbidden", 403)

    user = User.query.get_or_404(user_id)
    data = request.get_json(silent=True) or {}

    # Updateable fields
    if "full_name" in data:
        user.full_name = data["full_name"].strip()[:150]
    if "avatar_url" in data:
        user.avatar_url = data["avatar_url"]

    # Only admin can change roles
    if "role" in data and current.role == "admin":
        if data["role"] in ["admin", "teacher", "student"]:
            user.role = data["role"]

    db.session.commit()
    return success(user.to_dict(), "Profile updated")


# ── POST /api/users/<id>/avatar ───────────────────────────────────────────────

@users_bp.route("/<user_id>/avatar", methods=["POST"])
@jwt_required()
def upload_avatar(user_id):
    """Upload profile picture."""
    current = get_current_user()
    if current.id != user_id and current.role != "admin":
        return error("Forbidden", 403)

    if "file" not in request.files:
        return error("No file provided", 400)

    file = request.files["file"]
    if not file.filename or not allowed_file(file.filename):
        return error("Invalid file type. Allowed: png, jpg, jpeg", 400)

    path = save_upload(file, subfolder=f"avatars/{user_id}")
    user = User.query.get(user_id)
    user.avatar_url = f"/uploads/{path}"
    db.session.commit()

    return success({"avatar_url": user.avatar_url}, "Avatar uploaded")


# ── GET /api/users/me/projects ───────────────────────────────────────────────

@users_bp.route("/me/projects", methods=["GET"])
@jwt_required()
def my_projects():
    """Return projects for the current user.
    Teachers/admins see all projects; students see only their memberships."""
    user = get_current_user()
    if user.role in ["teacher", "admin"]:
        projects = [p.to_dict() for p in Project.query.filter_by(is_active=True).all()]
    else:
        memberships = ProjectMember.query.filter_by(user_id=user.id, is_active=True).all()
        projects = []
        for m in memberships:
            p = m.project.to_dict()
            p["role_in_group"] = m.role_in_group
            projects.append(p)
    return success(projects)


# ── GET /api/users/<id>/projects ─────────────────────────────────────────────

@users_bp.route("/<user_id>/projects", methods=["GET"])
@jwt_required()
def user_projects(user_id):
    """Get all projects a user belongs to."""
    current = get_current_user()
    if current.id != user_id and current.role not in ["admin", "teacher"]:
        return error("Forbidden", 403)

    memberships = ProjectMember.query.filter_by(user_id=user_id, is_active=True).all()
    projects = []
    for m in memberships:
        p = m.project.to_dict()
        p["role_in_group"] = m.role_in_group
        projects.append(p)

    return success(projects)




# ── POST /api/users/<id>/remind ───────────────────────────────────────────────

@users_bp.route("/<user_id>/remind", methods=["POST"])
@jwt_required()
def send_reminder(user_id):
    """Send a reminder notification to a specific member (teacher/admin only)."""
    user = User.query.get_or_404(user_id)
    data = request.get_json(silent=True) or {}

    message = data.get(
        "message",
        "Your instructor has sent you a reminder to stay active and keep up with your project work."
    )

    notif = Notification(
        user_id     = user_id,
        title       = "Reminder from Instructor",
        message     = message,
        type        = "system",
        entity_type = "reminder",
    )
    db.session.add(notif)
    db.session.commit()

    return success({"recipient": user.full_name}, f"Reminder sent to {user.full_name}")


# ── POST /api/users/<id>/flag-inactive ───────────────────────────────────────

@users_bp.route("/<user_id>/flag-inactive", methods=["POST"])
@jwt_required()
def flag_inactive(user_id):
    """Flag a member as inactive, escalate their risk to HIGH, and notify them.
    Body: { "project_id": "..." }  (optional — flags all memberships if omitted)
    """
    user       = User.query.get_or_404(user_id)
    data       = request.get_json(silent=True) or {}
    project_id = data.get("project_id")

    query = ProjectMember.query.filter_by(user_id=user_id, is_active=True)
    if project_id:
        query = query.filter_by(project_id=project_id)

    memberships = query.all()
    if not memberships:
        return error("No active membership found for this user", 404)

    # Escalate risk profile to HIGH
    risk = RiskProfile.query.filter_by(user_id=user_id).first()
    if risk:
        risk.risk_level = RiskLevel.HIGH
        flags = list(risk.flags or [])
        if "manually_flagged_inactive" not in flags:
            flags.append("manually_flagged_inactive")
        risk.flags = flags
        flag_modified(risk, "flags")

    # In-app notification to the flagged member
    notif = Notification(
        user_id     = user_id,
        title       = "You have been flagged as inactive",
        message     = "Your instructor has marked you as inactive. Please re-engage with your project as soon as possible.",
        type        = "warning",
        entity_type = "project",
        entity_id   = project_id,
    )
    db.session.add(notif)
    db.session.commit()

    return success({"flagged": user.full_name}, f"{user.full_name} flagged as inactive")

# ── DELETE /api/users/<id> ────────────────────────────────────────────────────

@users_bp.route("/<user_id>", methods=["DELETE"])
@jwt_required()
@admin_required
def deactivate_user(user_id):
    """Soft-delete (deactivate) a user account."""
    user = User.query.get_or_404(user_id)
    user.is_active = False
    db.session.commit()
    return success(None, "User deactivated")