"""
SkillSync — Configuration
==========================
Three config classes: Base, Development, Production.
Loaded via FLASK_ENV environment variable.
"""

import os
from datetime import timedelta


class BaseConfig:
    """Shared settings across all environments."""

    APP_NAME    = "SkillSync"
    SECRET_KEY  = os.getenv("SECRET_KEY", "dev-secret-change-me")
    DEBUG       = False
    TESTING     = False

    # ── Database ──────────────────────────────────────────────────────────────
    SQLALCHEMY_DATABASE_URI    = os.getenv("DATABASE_URL", "sqlite:///skillsync.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO            = False

    # ── JWT ───────────────────────────────────────────────────────────────────
    JWT_SECRET_KEY                  = os.getenv("JWT_SECRET_KEY", "jwt-secret-change-me")
    JWT_ACCESS_TOKEN_EXPIRES        = timedelta(hours=1)
    JWT_REFRESH_TOKEN_EXPIRES       = timedelta(days=30)
    JWT_TOKEN_LOCATION              = ["headers"]
    JWT_HEADER_NAME                 = "Authorization"
    JWT_HEADER_TYPE                 = "Bearer"

    # ── Mail ──────────────────────────────────────────────────────────────────
    MAIL_SERVER          = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT            = int(os.getenv("MAIL_PORT", 587))
    MAIL_USE_TLS         = os.getenv("MAIL_USE_TLS", "True") == "True"
    MAIL_USERNAME        = os.getenv("MAIL_USERNAME")
    MAIL_PASSWORD        = os.getenv("MAIL_PASSWORD")
    MAIL_DEFAULT_SENDER  = os.getenv("MAIL_DEFAULT_SENDER", "SkillSync <noreply@skillsync.edu>")

    # ── File Upload ───────────────────────────────────────────────────────────
    UPLOAD_FOLDER        = os.getenv("UPLOAD_FOLDER", "uploads")
    MAX_CONTENT_LENGTH   = int(os.getenv("MAX_CONTENT_LENGTH", 16 * 1024 * 1024))  # 16 MB
    ALLOWED_EXTENSIONS   = set(os.getenv("ALLOWED_EXTENSIONS", "pdf,doc,docx,zip,png,jpg,jpeg").split(","))

    # ── Pomodoro ──────────────────────────────────────────────────────────────
    POMODORO_WORK_MINUTES          = int(os.getenv("POMODORO_WORK_MINUTES", 25))
    POMODORO_SHORT_BREAK           = int(os.getenv("POMODORO_SHORT_BREAK", 5))
    POMODORO_LONG_BREAK            = int(os.getenv("POMODORO_LONG_BREAK", 15))
    POMODORO_SESSIONS_BEFORE_LONG  = int(os.getenv("POMODORO_SESSIONS_BEFORE_LONG", 4))

    # ── AI Detection ──────────────────────────────────────────────────────────
    AI_SIMILARITY_THRESHOLD   = float(os.getenv("AI_SIMILARITY_THRESHOLD", 0.75))
    AI_LARGE_PASTE_THRESHOLD  = int(os.getenv("AI_LARGE_PASTE_THRESHOLD", 500))

    # ── Certificate ───────────────────────────────────────────────────────────
    CERT_ISSUER               = os.getenv("CERT_ISSUER", "SkillSync University Platform")
    CERT_VERIFICATION_BASE_URL = os.getenv("CERT_VERIFICATION_BASE_URL", "https://skillsync.edu/verify")

    # ── Redis / Celery ────────────────────────────────────────────────────────
    REDIS_URL               = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CELERY_BROKER_URL       = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
    CELERY_RESULT_BACKEND   = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")


class DevelopmentConfig(BaseConfig):
    """Development — verbose, SQLite-friendly."""
    DEBUG               = True
    SQLALCHEMY_ECHO     = True   # Log all SQL queries
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=1)  # Longer for dev


class ProductionConfig(BaseConfig):
    """Production — strict, PostgreSQL required."""
    DEBUG   = False
    TESTING = False

    # Force PostgreSQL in production
    @property
    def SQLALCHEMY_DATABASE_URI(self):
        uri = os.getenv("DATABASE_URL")
        if not uri:
            raise RuntimeError("DATABASE_URL must be set in production")
        # Heroku uses postgres:// but SQLAlchemy needs postgresql://
        return uri.replace("postgres://", "postgresql://", 1)


class TestingConfig(BaseConfig):
    """Testing — in-memory SQLite, no mail."""
    TESTING             = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=5)
    MAIL_SUPPRESS_SEND  = True
    WTF_CSRF_ENABLED    = False


# ── Config Map ────────────────────────────────────────────────────────────────
config_map = {
    "development": DevelopmentConfig,
    "production":  ProductionConfig,
    "testing":     TestingConfig,
    "default":     DevelopmentConfig,
}