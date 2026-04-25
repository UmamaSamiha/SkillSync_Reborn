from datetime import datetime, timezone
from flask import Blueprint, request
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, get_jwt,
    decode_token
)

from app import db, bcrypt
from app.models import User, RefreshToken, RevokedToken, Role, ActivityLog
from app.utils.helpers import success, error, validate_required, get_current_user

auth_bp = Blueprint("auth", __name__)


def _store_refresh_token(user_id, refresh_token):
    decoded = decode_token(refresh_token)
    db.session.add(RefreshToken(user_id=user_id, token_jti=decoded["jti"]))
    db.session.commit()


# ── POST /api/auth/register ───────────────────────────────────────────────────

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    missing = validate_required(data, ["email", "password", "full_name"])
    if missing:
        return error(f"Missing required fields: {', '.join(missing)}", 400)

    email     = data["email"].strip().lower()
    password  = data["password"]
    full_name = data["full_name"].strip()

    # Allow student or teacher roles on signup — admin must be seeded
    requested_role = data.get("role", "student").lower()
    if requested_role == "teacher":
        role = Role.TEACHER
    else:
        role = Role.STUDENT

    if "@" not in email or "." not in email.split("@")[-1]:
        return error("Invalid email address", 400)

    if len(password) < 8:
        return error("Password must be at least 8 characters", 400)

    if User.query.filter_by(email=email).first():
        return error("Email already registered", 409)

    pw_hash = bcrypt.generate_password_hash(password).decode("utf-8")
    user = User(
        email=email,
        password_hash=pw_hash,
        full_name=full_name,
        role=role,
    )
    db.session.add(user)
    db.session.commit()

    access_token  = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    _store_refresh_token(user.id, refresh_token)

    return success({
        "user":          user.to_dict(),
        "access_token":  access_token,
        "refresh_token": refresh_token,
    }, "Registration successful", 201)


# ── POST /api/auth/login ──────────────────────────────────────────────────────

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    missing = validate_required(data, ["email", "password"])
    if missing:
        return error(f"Missing fields: {', '.join(missing)}", 400)

    email    = data["email"].strip().lower()
    password = data["password"]

    user = User.query.filter_by(email=email).first()

    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        return error("Invalid email or password", 401)

    if not user.is_active:
        return error("Account is deactivated. Contact your administrator.", 403)

    user.last_active = datetime.now(timezone.utc)
    db.session.commit()

    log = ActivityLog(user_id=user.id, action_type="login")
    db.session.add(log)
    db.session.commit()

    access_token  = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    _store_refresh_token(user.id, refresh_token)

    return success({
        "user":          user.to_dict(),
        "access_token":  access_token,
        "refresh_token": refresh_token,
    }, "Login successful")


# ── POST /api/auth/refresh ────────────────────────────────────────────────────

@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    user_id      = get_jwt_identity()
    access_token = create_access_token(identity=user_id)
    return success({"access_token": access_token}, "Token refreshed")


# ── POST /api/auth/logout ─────────────────────────────────────────────────────

@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    jti     = get_jwt()["jti"]
    user_id = get_jwt_identity()

    if not RevokedToken.query.filter_by(jti=jti).first():
        db.session.add(RevokedToken(jti=jti))

    active_tokens = RefreshToken.query.filter_by(user_id=int(user_id), revoked=False).all()
    for rt in active_tokens:
        rt.revoked = True
        if not RevokedToken.query.filter_by(jti=rt.token_jti).first():
            db.session.add(RevokedToken(jti=rt.token_jti))

    db.session.commit()
    return success(None, "Logged out successfully")


# ── GET /api/auth/me ──────────────────────────────────────────────────────────

@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    return success(user.to_dict())


# ── PUT /api/auth/change-password ─────────────────────────────────────────────

@auth_bp.route("/change-password", methods=["PUT"])
@jwt_required()
def change_password():
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