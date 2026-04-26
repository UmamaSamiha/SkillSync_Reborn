from datetime import datetime, timezone
from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from app import db
from app.models import Portfolio, PortfolioProject, User
from app.utils.helpers import success, error, get_current_user

portfolio_bp = Blueprint("portfolio", __name__)


def _get_or_create_portfolio(user_id):
    p = Portfolio.query.filter_by(user_id=user_id).first()
    if not p:
        p = Portfolio(user_id=user_id, skills=[])
        db.session.add(p)
        db.session.commit()
    return p


# ── GET /api/portfolio/<user_id> ──────────────────────────────────────────────
@portfolio_bp.route("/<int:user_id>", methods=["GET"])
@jwt_required()
def get_portfolio(user_id):
    user = User.query.get_or_404(user_id)
    portfolio = _get_or_create_portfolio(user_id)
    data = portfolio.to_dict()
    data["full_name"] = user.full_name
    data["email"]     = user.email
    data["role"]      = user.role.value
    return success(data)


# ── PUT /api/portfolio/<user_id> ──────────────────────────────────────────────
@portfolio_bp.route("/<int:user_id>", methods=["PUT"])
@jwt_required()
def update_portfolio(user_id):
    current = get_current_user()
    if current.id != user_id and current.role.value not in ("admin", "teacher"):
        return error("Forbidden", 403)

    portfolio = _get_or_create_portfolio(user_id)
    data = request.get_json(silent=True) or {}

    if "bio"          in data: portfolio.bio          = data["bio"]
    if "github_url"   in data: portfolio.github_url   = data["github_url"]
    if "linkedin_url" in data: portfolio.linkedin_url = data["linkedin_url"]
    if "skills"       in data: portfolio.skills       = data["skills"]

    portfolio.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return success(portfolio.to_dict())


# ── POST /api/portfolio/<user_id>/projects ────────────────────────────────────
@portfolio_bp.route("/<int:user_id>/projects", methods=["POST"])
@jwt_required()
def add_project(user_id):
    current = get_current_user()
    if current.id != user_id and current.role.value not in ("admin", "teacher"):
        return error("Forbidden", 403)

    data = request.get_json(silent=True) or {}
    if not data.get("title"):
        return error("title is required", 400)

    portfolio = _get_or_create_portfolio(user_id)
    project = PortfolioProject(
        portfolio_id = portfolio.id,
        title        = data["title"].strip(),
        description  = data.get("description", ""),
        url          = data.get("url", ""),
        tech_stack   = data.get("tech_stack", []),
    )
    db.session.add(project)
    db.session.commit()
    return success(project.to_dict(), status=201)


# ── PUT /api/portfolio/<user_id>/projects/<project_id> ────────────────────────
@portfolio_bp.route("/<int:user_id>/projects/<int:project_id>", methods=["PUT"])
@jwt_required()
def update_project(user_id, project_id):
    current = get_current_user()
    if current.id != user_id and current.role.value not in ("admin", "teacher"):
        return error("Forbidden", 403)

    project = PortfolioProject.query.get_or_404(project_id)
    data    = request.get_json(silent=True) or {}

    if "title"       in data: project.title       = data["title"].strip()
    if "description" in data: project.description = data["description"]
    if "url"         in data: project.url         = data["url"]
    if "tech_stack"  in data: project.tech_stack  = data["tech_stack"]

    db.session.commit()
    return success(project.to_dict())


# ── DELETE /api/portfolio/<user_id>/projects/<project_id> ─────────────────────
@portfolio_bp.route("/<int:user_id>/projects/<int:project_id>", methods=["DELETE"])
@jwt_required()
def delete_project(user_id, project_id):
    current = get_current_user()
    if current.id != user_id and current.role.value not in ("admin", "teacher"):
        return error("Forbidden", 403)

    project = PortfolioProject.query.get_or_404(project_id)
    db.session.delete(project)
    db.session.commit()
    return success(None, "Project deleted")