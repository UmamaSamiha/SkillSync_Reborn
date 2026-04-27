from datetime import timedelta

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_migrate import Migrate
from dotenv import load_dotenv
import os

load_dotenv()

db      = SQLAlchemy()
bcrypt  = Bcrypt()
jwt     = JWTManager()
migrate = Migrate()


def create_app():
    app = Flask(__name__)

    app.config["SQLALCHEMY_DATABASE_URI"]        = os.getenv("DATABASE_URL", "postgresql+pg8000://postgres:1234@127.0.0.1:5432/skillsync")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["JWT_SECRET_KEY"]                 = os.getenv("JWT_SECRET_KEY", "dev-secret-change-me")
    app.config["JWT_ACCESS_TOKEN_EXPIRES"]       = timedelta(hours=1)
    app.config["JWT_REFRESH_TOKEN_EXPIRES"]      = timedelta(days=30)

    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)
    jwt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        from app.models import RevokedToken
        jti = jwt_payload["jti"]
        return RevokedToken.query.filter_by(jti=jti).first() is not None

    from app.routes.auth          import auth_bp
    from app.routes.curriculum    import curriculum_bp
    from app.routes.student       import student_bp
    from app.routes.portfolio     import portfolio_bp
    from app.routes.question_bank import qbank_bp
    from app.routes.edit_tracking import edit_tracking_bp

    app.register_blueprint(auth_bp,          url_prefix="/api/auth")
    app.register_blueprint(curriculum_bp,    url_prefix="/api/curriculum")
    app.register_blueprint(student_bp,       url_prefix="/api/student")
    app.register_blueprint(portfolio_bp,     url_prefix="/api/portfolio")
    app.register_blueprint(qbank_bp,         url_prefix="/api/question-bank")
    app.register_blueprint(edit_tracking_bp, url_prefix="/api/edits")

    with app.app_context():
        from app.routes.edit_tracking import Submission, EditEvent  # noqa
        db.create_all()
        _seed_admin()
        _seed_topics()

    return app


def _seed_admin():
    from app.models import User, Role
    if not User.query.filter_by(role=Role.ADMIN).first():
        pw_hash = bcrypt.generate_password_hash("admin123").decode("utf-8")
        admin = User(
            email="admin@skillsync.edu",
            password_hash=pw_hash,
            full_name="Admin User",
            role=Role.ADMIN,
        )
        db.session.add(admin)

        pw_hash2 = bcrypt.generate_password_hash("password123").decode("utf-8")
        student = User(
            email="anushka@skillsync.edu",
            password_hash=pw_hash2,
            full_name="Anushka Demo",
            role=Role.STUDENT,
        )
        db.session.add(student)

        pw_hash3 = bcrypt.generate_password_hash("teacher123").decode("utf-8")
        teacher = User(
            email="teacher@skillsync.edu",
            password_hash=pw_hash3,
            full_name="Demo Teacher",
            role=Role.TEACHER,
        )
        db.session.add(teacher)

        db.session.commit()
        print("✅ Seeded admin, demo student and demo teacher")


def _seed_topics():
    from app.models import Topic, TopicPrerequisite, Certificate  # noqa: F401

    if Topic.query.first():
        return

    track = "Python Basics"
    topics_data = [
        {"title": "Variables & Data Types",  "description": "Learn about integers, strings, booleans and how to store data.", "order": 1, "mastery_threshold": 70},
        {"title": "Control Flow",            "description": "Master if/else, loops, and branching logic.",                    "order": 2, "mastery_threshold": 75},
        {"title": "Functions",               "description": "Write reusable blocks of code with parameters and return values.", "order": 3, "mastery_threshold": 75},
        {"title": "Object-Oriented Python",  "description": "Classes, objects, inheritance and encapsulation.",                "order": 4, "mastery_threshold": 80},
        {"title": "Algorithms & Complexity", "description": "Sorting, searching, and understanding Big-O notation.",            "order": 5, "mastery_threshold": 80},
    ]

    created = []
    for td in topics_data:
        t = Topic(track=track, **td)
        db.session.add(t)
        db.session.flush()
        created.append(t)

    for i in range(1, len(created)):
        db.session.add(TopicPrerequisite(
            topic_id=created[i].id,
            prerequisite_id=created[i - 1].id,
        ))

    db.session.commit()
    print("✅ Seeded Python Basics curriculum")