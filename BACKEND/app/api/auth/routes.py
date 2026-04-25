"""
SkillSync — Auth API
=====================
Endpoints: register, login, refresh token, logout, me.
JWT-based with bcrypt password hashing.
"""

from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, get_jwt
)

from app import db, bcrypt
from app.models import User, RefreshToken, Role, ActivityLog, Notification, Project, ProjectMember
from app.utils.helpers import success, error, validate_required, get_current_user

auth_bp = Blueprint("auth", __name__)


# ── POST /api/auth/register ───────────────────────────────────────────────────

@auth_bp.route("/register", methods=["POST"])
def register():
    """
    Register a new user.
    Body: { email, password, full_name, role? }
    Role defaults to 'student'; only admins can create teachers/admins.
    """
    data = request.get_json(silent=True) or {}

    # Validate required fields
    missing = validate_required(data, ["email", "password", "full_name"])
    if missing:
        return error(f"Missing required fields: {', '.join(missing)}", 400)

    email     = data["email"].strip().lower()
    password  = data["password"]
    full_name = data["full_name"].strip()
    role      = data.get("role", Role.STUDENT)

    # Only allow student self-registration; teachers/admins need admin invite
    if role not in [Role.STUDENT, Role.TEACHER, Role.ADMIN]:
        return error("Invalid role", 400)

    # Email format validation
    if "@" not in email or "." not in email.split("@")[-1]:
        return error("Invalid email address", 400)

    # Password strength
    if len(password) < 8:
        return error("Password must be at least 8 characters", 400)

    # Duplicate check
    if User.query.filter_by(email=email).first():
        return error("Email already registered", 409)

    # Hash password and create user — active immediately
    pw_hash = bcrypt.generate_password_hash(password).decode("utf-8")
    user = User(
        email=email,
        password_hash=pw_hash,
        full_name=full_name,
        role=role,
        is_active=True,
    )
    db.session.add(user)
    db.session.flush()

    # Auto-enroll students in all active projects (joined_at = now keeps old assignments hidden)
    if role == Role.STUDENT:
        for project in Project.query.filter_by(is_active=True).all():
            db.session.add(ProjectMember(
                project_id=project.id,
                user_id=user.id,
                role_in_group="member",
            ))

    # Notify all admins about the new signup
    admins = User.query.filter_by(role=Role.ADMIN, is_active=True).all()
    for admin in admins:
        n = Notification(
            user_id     = admin.id,
            title       = f"New {role.title()} Registration",
            message     = f"{full_name} ({email}) has registered as a {role}.",
            type        = "info",
            entity_type = "user",
            entity_id   = user.id,
        )
        db.session.add(n)

    db.session.commit()

    access_token  = create_access_token(identity=user.id)
    refresh_token = create_refresh_token(identity=user.id)

    return success({
        "user":          user.to_dict(),
        "access_token":  access_token,
        "refresh_token": refresh_token,
    }, "Registration successful", 201)


# ── POST /api/auth/login ──────────────────────────────────────────────────────

@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Authenticate user and issue JWT tokens.
    Body: { email, password }
    """
    data = request.get_json(silent=True) or {}

    missing = validate_required(data, ["email", "password"])
    if missing:
        return error(f"Missing fields: {', '.join(missing)}", 400)

    email    = data["email"].strip().lower()
    password = data["password"]

    user = User.query.filter_by(email=email).first()

    # Constant-time check to prevent timing attacks
    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        return error("Invalid email or password", 401)

    if not user.is_active:
        return error("Your account is pending admin approval. Please wait for verification.", 403)

    # Update last active
    user.last_active = datetime.now(timezone.utc)
    db.session.commit()

    # Log activity
    log = ActivityLog(user_id=user.id, action_type="login")
    db.session.add(log)
    db.session.commit()

    access_token  = create_access_token(identity=user.id)
    refresh_token = create_refresh_token(identity=user.id)

    return success({
        "user":          user.to_dict(),
        "access_token":  access_token,
        "refresh_token": refresh_token,
    }, "Login successful")


# ── POST /api/auth/refresh ────────────────────────────────────────────────────

@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    """
    Use a refresh token to get a new access token.
    Requires: Authorization: Bearer <refresh_token>
    """
    user_id      = get_jwt_identity()
    access_token = create_access_token(identity=user_id)
    return success({"access_token": access_token}, "Token refreshed")


# ── POST /api/auth/logout ─────────────────────────────────────────────────────

@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    """
    Logout — client should discard tokens.
    Optionally revoke refresh token from DB.
    """
    jti     = get_jwt().get("jti")
    user_id = get_jwt_identity()

    # Mark refresh token revoked if stored
    rt = RefreshToken.query.filter_by(user_id=user_id, token_jti=jti).first()
    if rt:
        rt.revoked = True
        db.session.commit()

    return success(None, "Logged out successfully")


# ── GET /api/auth/me ──────────────────────────────────────────────────────────

@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    """Return the current authenticated user's profile."""
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    return success(user.to_dict())


# ── PUT /api/auth/change-password ─────────────────────────────────────────────

@auth_bp.route("/change-password", methods=["PUT"])
@jwt_required()
def change_password():
    """
    Change current user's password.
    Body: { current_password, new_password }
    """
    user = get_current_user()
    data = request.get_json(silent=True) or {}

    if not bcrypt.check_password_hash(user.password_hash, data.get("current_password", "")):
        return error("Current password is incorrect", 400)

    new_password = data.get("new_password", "")
    if len(new_password) < 8:
        return error("New password must be at least 8 characters", 400)

    user.password_hash = bcrypt.generate_password_hash(new_password).decode("utf-8")
    db.session.commit()

    return success(None, "Password changed successfully")