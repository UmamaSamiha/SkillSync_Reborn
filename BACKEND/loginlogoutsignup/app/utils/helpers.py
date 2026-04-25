from flask import jsonify
from flask_jwt_extended import get_jwt_identity
from app import db


def success(data=None, message="Success", status=200):
    """Standard success response."""
    resp = {"success": True, "message": message}
    if data is not None:
        resp["data"] = data
    return jsonify(resp), status


def error(message="An error occurred", status=400):
    """Standard error response."""
    return jsonify({"success": False, "error": message}), status


def validate_required(data: dict, fields: list[str]) -> list[str]:
    """Return list of missing required field names."""
    return [f for f in fields if not data.get(f)]


def get_current_user():
    """Return the User model for the current JWT identity."""
    from app.models import User
    user_id = get_jwt_identity()
    return db.session.get(User, int(user_id))
