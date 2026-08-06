"""
SkillSync — AI Learning Twin API
===================================
GET  /api/learning-twin/me       Current student's learning profile (computed/cached)
POST /api/learning-twin/refresh  Force a recompute of the current student's profile
"""
from flask import Blueprint
from flask_jwt_extended import jwt_required

from app.models import Role
from app.utils.helpers import success, error, get_current_user
from app.services.learning_twin_engine import get_or_compute_profile, compute_profile

learning_twin_bp = Blueprint("learning_twin", __name__)


@learning_twin_bp.route("/me", methods=["GET"])
@jwt_required()
def my_profile():
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    if user.role != Role.STUDENT:
        return error("Learning Twin is only available for students", 403)

    profile = get_or_compute_profile(user.id)
    return success(profile.to_dict())


@learning_twin_bp.route("/refresh", methods=["POST"])
@jwt_required()
def refresh_profile():
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    if user.role != Role.STUDENT:
        return error("Learning Twin is only available for students", 403)

    profile = compute_profile(user.id)
    return success(profile.to_dict(), "Learning Twin refreshed")
