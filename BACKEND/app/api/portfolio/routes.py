"""
SkillSync — Portfolio API
==========================
Student portfolio: skills, featured projects, contribution stats.
"""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from app import db
from app.models import Portfolio, PortfolioProject, User
from app.utils.helpers import success, error, get_current_user, validate_required

portfolio_bp = Blueprint("portfolio", __name__)

@portfolio_bp.route("/<user_id>", methods=["GET"])
@jwt_required()
def get_portfolio(user_id):
    p = Portfolio.query.filter_by(user_id=user_id).first()
    if not p:
        # Auto-create empty portfolio on first visit
        p = Portfolio(user_id=user_id, bio='', github_url='', linkedin_url='', skills=[])
        db.session.add(p)
        db.session.commit()
    user = User.query.get(user_id)
    data = p.to_dict()
    data["full_name"] = user.full_name if user else ""
    data["role"]      = user.role      if user else ""
    data["projects"]  = [proj.to_dict() for proj in p.projects.all()]
    return success(data)

@portfolio_bp.route("/<user_id>", methods=["PUT"])
@jwt_required()
def update_portfolio(user_id):
    current = get_current_user()
    if current.id != user_id and current.role != "admin":
        return error("Forbidden", 403)
    data = request.get_json(silent=True) or {}
    p = Portfolio.query.filter_by(user_id=user_id).first()
    if not p:
        p = Portfolio(user_id=user_id)
        db.session.add(p)
    if "bio"          in data: p.bio          = data["bio"]
    if "github_url"   in data: p.github_url   = data["github_url"]
    if "linkedin_url" in data: p.linkedin_url = data["linkedin_url"]
    if "skills"       in data: p.skills       = data["skills"]
    db.session.commit()
    user = User.query.get(user_id)
    result = p.to_dict()
    result["full_name"] = user.full_name if user else ""
    result["role"]      = user.role      if user else ""
    result["projects"]  = [proj.to_dict() for proj in p.projects.all()]
    return success(result, "Portfolio updated")

@portfolio_bp.route("/<user_id>/projects", methods=["POST"])
@jwt_required()
def add_portfolio_project(user_id):
    current = get_current_user()
    if current.id != user_id:
        return error("Forbidden", 403)
    p = Portfolio.query.filter_by(user_id=user_id).first()
    if not p:
        p = Portfolio(user_id=user_id)
        db.session.add(p)
        db.session.flush()
    data = request.get_json(silent=True) or {}
    missing = validate_required(data, ["title"])
    if missing:
        return error("Title is required", 400)
    proj = PortfolioProject(
        portfolio_id = p.id,
        project_id   = data.get("project_id"),
        title        = data["title"],
        description  = data.get("description", ""),
        role         = data.get("role", ""),
        is_featured  = bool(data.get("is_featured", False)),
    )
    db.session.add(proj)
    db.session.commit()
    return success(proj.to_dict(), "Project added", 201)

@portfolio_bp.route("/<user_id>/projects/<project_id>", methods=["DELETE"])
@jwt_required()
def delete_portfolio_project(user_id, project_id):
    current = get_current_user()
    if current.id != user_id:
        return error("Forbidden", 403)
    proj = PortfolioProject.query.filter_by(id=project_id).first()
    if not proj:
        return error("Project not found", 404)
    db.session.delete(proj)
    db.session.commit()
    return success(None, "Project deleted")