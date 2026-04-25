from datetime import datetime, timezone
from app import db
import enum


class Role(str, enum.Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN   = "admin"


class User(db.Model):
    __tablename__ = "users"

    id            = db.Column(db.Integer, primary_key=True)
    email         = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name     = db.Column(db.String(255), nullable=False)
    role          = db.Column(db.Enum(Role), nullable=False, default=Role.STUDENT)
    is_active     = db.Column(db.Boolean, default=True, nullable=False)
    created_at    = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_active   = db.Column(db.DateTime(timezone=True), nullable=True)

    refresh_tokens   = db.relationship("RefreshToken",      backref="user",    lazy=True, cascade="all, delete-orphan")
    activity_logs    = db.relationship("ActivityLog",       backref="user",    lazy=True, cascade="all, delete-orphan")
    progress_records = db.relationship("UserTopicProgress", backref="user",    lazy=True, cascade="all, delete-orphan")
    portfolio        = db.relationship("Portfolio",         backref="user",    lazy=True, uselist=False, cascade="all, delete-orphan")
    question_banks   = db.relationship("QuestionBank",      backref="creator", lazy=True, cascade="all, delete-orphan")
    questions        = db.relationship("Question",          backref="creator", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id":          self.id,
            "email":       self.email,
            "full_name":   self.full_name,
            "role":        self.role.value,
            "is_active":   self.is_active,
            "created_at":  self.created_at.isoformat() if self.created_at else None,
            "last_active": self.last_active.isoformat() if self.last_active else None,
        }

    def __repr__(self):
        return f"<User {self.email} ({self.role.value})>"


class RefreshToken(db.Model):
    __tablename__ = "refresh_tokens"

    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    token_jti  = db.Column(db.String(255), unique=True, nullable=False)
    revoked    = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<RefreshToken user_id={self.user_id} revoked={self.revoked}>"


class RevokedToken(db.Model):
    __tablename__ = "revoked_tokens"

    id         = db.Column(db.Integer, primary_key=True)
    jti        = db.Column(db.String(255), unique=True, nullable=False, index=True)
    revoked_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<RevokedToken jti={self.jti}>"


class ActivityLog(db.Model):
    __tablename__ = "activity_logs"

    id          = db.Column(db.Integer, primary_key=True)
    user_id     = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    action_type = db.Column(db.String(100), nullable=False)
    extra_data  = db.Column(db.JSON, nullable=True)
    created_at  = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id":          self.id,
            "user_id":     self.user_id,
            "action_type": self.action_type,
            "extra_data":  self.extra_data,
            "created_at":  self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<ActivityLog user_id={self.user_id} action={self.action_type}>"


# ── Curriculum / Prerequisite System ─────────────────────────────────────────

class Topic(db.Model):
    __tablename__ = "topics"

    id                = db.Column(db.Integer, primary_key=True)
    title             = db.Column(db.String(255), nullable=False)
    description       = db.Column(db.Text, nullable=True)
    track             = db.Column(db.String(100), nullable=False, default="General")
    order             = db.Column(db.Integer, nullable=False, default=0)
    mastery_threshold = db.Column(db.Integer, nullable=False, default=80)

    prerequisites    = db.relationship(
        "TopicPrerequisite",
        foreign_keys="TopicPrerequisite.topic_id",
        backref="topic",
        lazy=True,
        cascade="all, delete-orphan",
    )
    progress_records = db.relationship("UserTopicProgress", backref="topic", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id":                self.id,
            "title":             self.title,
            "description":       self.description,
            "track":             self.track,
            "order":             self.order,
            "mastery_threshold": self.mastery_threshold,
            "prerequisite_ids":  [p.prerequisite_id for p in self.prerequisites],
        }

    def __repr__(self):
        return f"<Topic {self.id}: {self.title}>"


class TopicPrerequisite(db.Model):
    __tablename__ = "topic_prerequisites"

    id              = db.Column(db.Integer, primary_key=True)
    topic_id        = db.Column(db.Integer, db.ForeignKey("topics.id"), nullable=False)
    prerequisite_id = db.Column(db.Integer, db.ForeignKey("topics.id"), nullable=False)

    __table_args__ = (db.UniqueConstraint("topic_id", "prerequisite_id"),)

    def __repr__(self):
        return f"<Prereq topic={self.topic_id} requires={self.prerequisite_id}>"


class UserTopicProgress(db.Model):
    __tablename__ = "user_topic_progress"

    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("users.id"),  nullable=False)
    topic_id   = db.Column(db.Integer, db.ForeignKey("topics.id"), nullable=False)
    status     = db.Column(db.String(20), nullable=False, default="locked")
    quiz_score = db.Column(db.Integer, nullable=True)
    attempts   = db.Column(db.Integer, nullable=False, default=0)
    updated_at = db.Column(db.DateTime(timezone=True),
                           default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (db.UniqueConstraint("user_id", "topic_id"),)

    def to_dict(self):
        return {
            "user_id":    self.user_id,
            "topic_id":   self.topic_id,
            "status":     self.status,
            "quiz_score": self.quiz_score,
            "attempts":   self.attempts,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<Progress user={self.user_id} topic={self.topic_id} status={self.status}>"


# ── Certificate ───────────────────────────────────────────────────────────────

class Certificate(db.Model):
    __tablename__ = "certificates"

    id        = db.Column(db.Integer, primary_key=True)
    user_id   = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title     = db.Column(db.String(255), nullable=False)
    track     = db.Column(db.String(100), nullable=True)
    issued_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (db.UniqueConstraint("user_id", "track"),)

    def to_dict(self):
        return {
            "id":        self.id,
            "user_id":   self.user_id,
            "title":     self.title,
            "track":     self.track,
            "issued_at": self.issued_at.isoformat() if self.issued_at else None,
        }

    def __repr__(self):
        return f"<Certificate user={self.user_id} track={self.track}>"


# ── Portfolio ─────────────────────────────────────────────────────────────────

class Portfolio(db.Model):
    __tablename__ = "portfolios"

    id           = db.Column(db.Integer, primary_key=True)
    user_id      = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False)
    bio          = db.Column(db.Text, nullable=True)
    github_url   = db.Column(db.String(500), nullable=True)
    linkedin_url = db.Column(db.String(500), nullable=True)
    skills       = db.Column(db.JSON, default=list)
    updated_at   = db.Column(db.DateTime(timezone=True),
                             default=lambda: datetime.now(timezone.utc),
                             onupdate=lambda: datetime.now(timezone.utc))

    projects = db.relationship("PortfolioProject", backref="portfolio", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id":           self.id,
            "user_id":      self.user_id,
            "bio":          self.bio,
            "github_url":   self.github_url,
            "linkedin_url": self.linkedin_url,
            "skills":       self.skills or [],
            "updated_at":   self.updated_at.isoformat() if self.updated_at else None,
            "projects":     [p.to_dict() for p in self.projects],
        }


class PortfolioProject(db.Model):
    __tablename__ = "portfolio_projects"

    id           = db.Column(db.Integer, primary_key=True)
    portfolio_id = db.Column(db.Integer, db.ForeignKey("portfolios.id"), nullable=False)
    title        = db.Column(db.String(255), nullable=False)
    description  = db.Column(db.Text, nullable=True)
    url          = db.Column(db.String(500), nullable=True)
    tech_stack   = db.Column(db.JSON, default=list)
    created_at   = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id":           self.id,
            "portfolio_id": self.portfolio_id,
            "title":        self.title,
            "description":  self.description,
            "url":          self.url,
            "tech_stack":   self.tech_stack or [],
            "created_at":   self.created_at.isoformat() if self.created_at else None,
        }


# ── Question Bank ─────────────────────────────────────────────────────────────

class QuestionBank(db.Model):
    __tablename__ = "question_banks"

    id          = db.Column(db.Integer, primary_key=True)
    created_by  = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title       = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at  = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    questions = db.relationship("Question", backref="bank", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id":          self.id,
            "created_by":  self.created_by,
            "title":       self.title,
            "description": self.description,
            "created_at":  self.created_at.isoformat() if self.created_at else None,
            "total":       len(self.questions),
        }


class Question(db.Model):
    __tablename__ = "questions"

    id             = db.Column(db.Integer, primary_key=True)
    bank_id        = db.Column(db.Integer, db.ForeignKey("question_banks.id"), nullable=False)
    created_by     = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    text           = db.Column(db.Text, nullable=False)
    question_type  = db.Column(db.String(50), nullable=False)
    difficulty     = db.Column(db.String(50), default="beginner")
    options        = db.Column(db.JSON, default=list)
    correct_answer = db.Column(db.Text, nullable=True)
    points         = db.Column(db.Integer, default=1)
    created_at     = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id":             self.id,
            "bank_id":        self.bank_id,
            "text":           self.text,
            "question_type":  self.question_type,
            "difficulty":     self.difficulty,
            "options":        self.options or [],
            "correct_answer": self.correct_answer,
            "points":         self.points,
            "created_at":     self.created_at.isoformat() if self.created_at else None,
        }