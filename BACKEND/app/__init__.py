"""
SkillSync — Flask Application Factory
======================================
Creates and configures the Flask app with all extensions,
blueprints, and error handlers registered.
"""

import os
from flask import Flask, jsonify   # FIXED
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_mail import Mail
from dotenv import load_dotenv

load_dotenv()

# ─── Extension Instances ─────────────────────────────────────────
db       = SQLAlchemy()
migrate  = Migrate()
jwt      = JWTManager()
bcrypt   = Bcrypt()
mail     = Mail()


def create_app(config_name: str = None) -> Flask:
    app = Flask(__name__, instance_relative_config=True)

    config_name = config_name or os.getenv("FLASK_ENV", "development")
    from app.config import config_map
    app.config.from_object(config_map[config_name])

    # ── Initialize Extensions ─────────────────────────────────────
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    bcrypt.init_app(app)
    mail.init_app(app)

    CORS(app, resources={
        r"/api/*": {
            "origins": os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
            "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True,
        }
    })

    # ── Blueprints ────────────────────────────────────────────────
    from app.api.auth.routes         import auth_bp
    from app.api.users.routes        import users_bp
    from app.api.assignments.routes  import assignments_bp
    from app.api.analytics.routes    import analytics_bp
    from app.api.admin.routes        import admin_bp
    from app.api.portfolio.routes    import portfolio_bp
    from app.api.focus.routes        import focus_bp
    from app.api.heatmap.routes      import heatmap_bp
    from app.api.certificates.routes import certificates_bp
    from app.api.notifications.routes import notifications_bp
    from app.api.courses.routes        import courses_bp
    from app.api.timelogs.routes       import timelogs_bp

    app.register_blueprint(auth_bp,         url_prefix="/api/auth")
    app.register_blueprint(users_bp,        url_prefix="/api/users")
    app.register_blueprint(assignments_bp,  url_prefix="/api/assignments")
    app.register_blueprint(analytics_bp,    url_prefix="/api/analytics")
    app.register_blueprint(admin_bp,        url_prefix="/api/admin")
    app.register_blueprint(portfolio_bp,    url_prefix="/api/portfolio")
    app.register_blueprint(focus_bp,        url_prefix="/api/focus")
    app.register_blueprint(heatmap_bp,      url_prefix="/api/heatmap")
    app.register_blueprint(certificates_bp, url_prefix="/api/certificates")
    app.register_blueprint(notifications_bp, url_prefix="/api/notifications")
    app.register_blueprint(courses_bp,      url_prefix="/api/courses")
    app.register_blueprint(timelogs_bp,     url_prefix="/api/timelogs")

    # ── JWT Callbacks ─────────────────────────────────────────────
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({
            "error": "Token has expired",
            "code": "TOKEN_EXPIRED"
        }), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({
            "error": "Invalid token",
            "code": "TOKEN_INVALID"
        }), 401

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({
            "error": "Authorization token required",
            "code": "TOKEN_MISSING"
        }), 401

    # ── Error Handlers (FIXED CLEAN OUTPUT) ───────────────────────
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({
            "error": "Bad request"
        }), 400

    @app.errorhandler(403)
    def forbidden(e):
        return jsonify({
            "error": "Forbidden",
            "message": "Insufficient permissions"
        }), 403

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({
            "error": "Not found"
        }), 404

    @app.errorhandler(422)
    def unprocessable(e):
        return jsonify({
            "error": "Unprocessable entity"
        }), 422

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({
            "error": "Internal server error"
        }), 500

    # ── Health Check ──────────────────────────────────────────────
    @app.route("/api/health")
    def health():
        return jsonify({
            "status": "ok",
            "app": "SkillSync",
            "version": "1.0.0"
        })

    @app.shell_context_processor
    def make_shell_context():
        from app import models
        return {"db": db, "app": app}

    return app