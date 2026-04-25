"""
SkillSync — Utilities
======================
Shared helpers: RBAC decorators, file validation,
pagination, and response formatters.
"""

import os
import uuid
from functools import wraps
from flask import jsonify, request, current_app
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from app.models import User, Role


# ── RBAC Decorators ───────────────────────────────────────────────

def role_required(*roles):
    """
    Decorator: ensure the JWT user has one of the allowed roles.
    Usage: @role_required(Role.ADMIN, Role.TEACHER)
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()

            user_id = get_jwt_identity()

            # FIX: User.id is UUID string — do NOT convert to int
            if not user_id:
                return jsonify({"error": "Invalid token identity"}), 401

            user = User.query.get(str(user_id))

            if not user:
                return jsonify({"error": "User not found"}), 404

            user_role = str(user.role)
            allowed_roles = [str(r) for r in roles]

            if user_role not in allowed_roles:
                return jsonify({
                    "error": "Forbidden",
                    "required_roles": allowed_roles
                }), 403

            return fn(*args, **kwargs)

        return wrapper
    return decorator


def admin_required(fn):
    return role_required(Role.ADMIN)(fn)


def teacher_or_admin(fn):
    return role_required(Role.ADMIN, Role.TEACHER)(fn)


def get_current_user():
    """
    Return the User object for the current JWT identity.
    FIX: User.id is UUID string — safe string lookup, no int cast
    """
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return None
        return User.query.get(str(user_id))
    except Exception:
        return None


# ── Response Helpers ───────────────────────────────────────────────

def success(data=None, message="Success", status=200):
    return jsonify({
        "success": True,
        "message": message,
        "data": data,
    }), status


def error(message="An error occurred", status=400, details=None):
    body = {"success": False, "error": message}
    if details:
        body["details"] = details
    return jsonify(body), status


# ── Pagination ─────────────────────────────────────────────────────

def paginate(query, schema_fn=None):
    page     = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 100)

    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    items = [schema_fn(item) for item in paginated.items] if schema_fn else paginated.items

    return {
        "items": items,
        "total": paginated.total,
        "page": paginated.page,
        "per_page": paginated.per_page,
        "pages": paginated.pages,
        "has_next": paginated.has_next,
        "has_prev": paginated.has_prev,
    }


# ── File Upload ────────────────────────────────────────────────────

def allowed_file(filename: str) -> bool:
    allowed = current_app.config.get("ALLOWED_EXTENSIONS", set())
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed


def save_upload(file, subfolder: str = "") -> str:
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    target_dir    = os.path.join(upload_folder, subfolder)
    os.makedirs(target_dir, exist_ok=True)

    ext = file.filename.rsplit(".", 1)[1].lower()
    safe_name = f"{uuid.uuid4().hex}.{ext}"

    filepath = os.path.join(target_dir, safe_name)
    file.save(filepath)

    return os.path.join(subfolder, safe_name)


# ── Input Validation ───────────────────────────────────────────────

def validate_required(data: dict, fields: list) -> list:
    return [f for f in fields if not data.get(f)]


def sanitize_string(value: str, max_length: int = 500) -> str:
    import bleach
    if not value:
        return ""
    cleaned = bleach.clean(str(value).strip())
    return cleaned[:max_length]