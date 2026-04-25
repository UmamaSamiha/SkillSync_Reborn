from datetime import datetime, timezone
import uuid
from app import db

def now_utc():
    return datetime.now(timezone.utc)

def gen_uuid():
    return str(uuid.uuid4())

class Role:
    ADMIN   = "admin"
    TEACHER = "teacher"
    STUDENT = "student"

class SubmissionStatus:
    DRAFT     = "draft"
    SUBMITTED = "submitted"
    GRADED    = "graded"
    LATE      = "late"

class SessionStatus:
    COMPLETED   = "completed"
    INTERRUPTED = "interrupted"
    IN_PROGRESS = "in_progress"

class RiskLevel:
    LOW    = "low"
    MEDIUM = "medium"
    HIGH   = "high"

class DifficultyLevel:
    BEGINNER     = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED     = "advanced"

class User(db.Model):
    __tablename__ = "users"
    id            = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    email         = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name     = db.Column(db.String(150), nullable=False)
    avatar_url    = db.Column(db.String(500), nullable=True)
    role          = db.Column(db.String(20), nullable=False, default=Role.STUDENT)
    is_active     = db.Column(db.Boolean, default=True, nullable=False)
    last_active   = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at    = db.Column(db.DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at    = db.Column(db.DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    project_memberships = db.relationship("ProjectMember", back_populates="user", lazy="dynamic")
    submissions         = db.relationship("Submission", foreign_keys="Submission.student_id", back_populates="student", lazy="dynamic")
    focus_sessions      = db.relationship("FocusSession", back_populates="user", lazy="dynamic")
    notifications       = db.relationship("Notification", back_populates="user", lazy="dynamic")
    portfolio           = db.relationship("Portfolio", back_populates="user", uselist=False)
    risk_profile        = db.relationship("RiskProfile", back_populates="user", uselist=False)
    certificates        = db.relationship("Certificate", back_populates="user", lazy="dynamic")
    engagement_scores   = db.relationship("EngagementScore", back_populates="user", lazy="dynamic")

    def to_dict(self):
        return {
            "id":          self.id,
            "email":       self.email,
            "full_name":   self.full_name,
            "avatar_url":  self.avatar_url,
            "role":        self.role,
            "is_active":   self.is_active,
            "last_active": self.last_active.isoformat() if self.last_active else None,
            "created_at":  self.created_at.isoformat(),
        }

class RefreshToken(db.Model):
    __tablename__ = "refresh_tokens"
    id         = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id    = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    token_jti  = db.Column(db.String(36), unique=True, nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    revoked    = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime(timezone=True), default=now_utc)
    user = db.relationship("User")

class Project(db.Model):
    __tablename__ = "projects"
    id          = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    name        = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    course_code = db.Column(db.String(50), nullable=True)
    created_by  = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    is_active   = db.Column(db.Boolean, default=True)
    start_date  = db.Column(db.Date, nullable=True)
    end_date    = db.Column(db.Date, nullable=True)
    created_at  = db.Column(db.DateTime(timezone=True), default=now_utc)
    updated_at  = db.Column(db.DateTime(timezone=True), default=now_utc, onupdate=now_utc)
    members     = db.relationship("ProjectMember", back_populates="project", lazy="dynamic")
    assignments = db.relationship("Assignment", back_populates="project", lazy="dynamic")
    creator     = db.relationship("User", foreign_keys=[created_by])

    def to_dict(self):
        return {
            "id":          self.id,
            "name":        self.name,
            "description": self.description,
            "course_code": self.course_code,
            "created_by":  self.created_by,
            "is_active":   self.is_active,
            "start_date":  self.start_date.isoformat() if self.start_date else None,
            "end_date":    self.end_date.isoformat() if self.end_date else None,
            "created_at":  self.created_at.isoformat(),
        }

class ProjectMember(db.Model):
    __tablename__ = "project_members"
    id            = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    project_id    = db.Column(db.String(36), db.ForeignKey("projects.id"), nullable=False)
    user_id       = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    role_in_group = db.Column(db.String(50), default="member")
    joined_at     = db.Column(db.DateTime(timezone=True), default=now_utc)
    is_active     = db.Column(db.Boolean, default=True)
    project = db.relationship("Project", back_populates="members")
    user    = db.relationship("User", back_populates="project_memberships")
    __table_args__ = (db.UniqueConstraint("project_id", "user_id"),)

class Topic(db.Model):
    __tablename__ = "topics"
    id              = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    project_id      = db.Column(db.String(36), db.ForeignKey("projects.id"), nullable=False)
    title           = db.Column(db.String(200), nullable=False)
    description     = db.Column(db.Text, nullable=True)
    order_index     = db.Column(db.Integer, default=0)
    difficulty      = db.Column(db.String(20), default=DifficultyLevel.BEGINNER)
    prerequisite_id = db.Column(db.String(36), db.ForeignKey("topics.id"), nullable=True)
    mastery_score   = db.Column(db.Float, default=70.0)
    created_at      = db.Column(db.DateTime(timezone=True), default=now_utc)
    prerequisite    = db.relationship("Topic", remote_side=[id])
    assignments     = db.relationship("Assignment", back_populates="topic", lazy="dynamic")
    resources       = db.relationship("Resource", back_populates="topic", lazy="dynamic")

    def to_dict(self):
        return {
            "id":              self.id,
            "title":           self.title,
            "description":     self.description,
            "order_index":     self.order_index,
            "difficulty":      self.difficulty,
            "prerequisite_id": self.prerequisite_id,
            "mastery_score":   self.mastery_score,
        }

class Resource(db.Model):
    __tablename__ = "resources"
    id         = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    topic_id   = db.Column(db.String(36), db.ForeignKey("topics.id"), nullable=False)
    title      = db.Column(db.String(200), nullable=False)
    type       = db.Column(db.String(50), nullable=False)
    url        = db.Column(db.String(500), nullable=True)
    file_path  = db.Column(db.String(500), nullable=True)
    difficulty = db.Column(db.String(20), default=DifficultyLevel.BEGINNER)
    created_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=now_utc)
    topic      = db.relationship("Topic", back_populates="resources")
    creator    = db.relationship("User")

class Assignment(db.Model):
    __tablename__ = "assignments"
    id          = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    project_id  = db.Column(db.String(36), db.ForeignKey("projects.id"), nullable=False)
    topic_id    = db.Column(db.String(36), db.ForeignKey("topics.id"), nullable=True)
    created_by  = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    title       = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    due_date    = db.Column(db.DateTime(timezone=True), nullable=True)
    max_score   = db.Column(db.Float, default=100.0)
    difficulty  = db.Column(db.String(20), default=DifficultyLevel.INTERMEDIATE)
    allow_late  = db.Column(db.Boolean, default=False)
    is_group    = db.Column(db.Boolean, default=False)
    created_at  = db.Column(db.DateTime(timezone=True), default=now_utc)
    updated_at  = db.Column(db.DateTime(timezone=True), default=now_utc, onupdate=now_utc)
    project     = db.relationship("Project", back_populates="assignments")
    topic       = db.relationship("Topic", back_populates="assignments")
    creator     = db.relationship("User", foreign_keys=[created_by])
    submissions = db.relationship("Submission", back_populates="assignment", lazy="dynamic")
    groups      = db.relationship("AssignmentGroup", back_populates="assignment", lazy="dynamic")

    def to_dict(self):
        return {
            "id":          self.id,
            "project_id":  self.project_id,
            "topic_id":    self.topic_id,
            "title":       self.title,
            "description": self.description,
            "due_date":    self.due_date.isoformat() if self.due_date else None,
            "max_score":   self.max_score,
            "difficulty":  self.difficulty,
            "allow_late":  self.allow_late,
            "is_group":    self.is_group,
            "created_at":  self.created_at.isoformat(),
        }

class AssignmentGroup(db.Model):
    __tablename__ = "assignment_groups"
    id            = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    assignment_id = db.Column(db.String(36), db.ForeignKey("assignments.id"), nullable=False)
    created_at    = db.Column(db.DateTime(timezone=True), default=now_utc)
    assignment    = db.relationship("Assignment", back_populates="groups")
    members       = db.relationship("GroupMembership", back_populates="group", lazy="dynamic")
    submission    = db.relationship("Submission", back_populates="group", uselist=False)

    def to_dict(self):
        return {
            "id":            self.id,
            "assignment_id": self.assignment_id,
            "members": [{"user_id": m.student_id, "full_name": m.student.full_name}
                        for m in self.members.all()],
        }


class GroupMembership(db.Model):
    __tablename__ = "group_memberships"
    id         = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    group_id   = db.Column(db.String(36), db.ForeignKey("assignment_groups.id"), nullable=False)
    student_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    group      = db.relationship("AssignmentGroup", back_populates="members")
    student    = db.relationship("User")
    __table_args__ = (db.UniqueConstraint("group_id", "student_id"),)


class Submission(db.Model):
    __tablename__ = "submissions"
    id               = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    assignment_id    = db.Column(db.String(36), db.ForeignKey("assignments.id"), nullable=False)
    student_id       = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    group_id         = db.Column(db.String(36), db.ForeignKey("assignment_groups.id"), nullable=True)
    content          = db.Column(db.Text, nullable=True)
    file_path        = db.Column(db.String(500), nullable=True)
    file_name        = db.Column(db.String(255), nullable=True)
    status           = db.Column(db.String(20), default=SubmissionStatus.DRAFT)
    score            = db.Column(db.Float, nullable=True)
    feedback         = db.Column(db.Text, nullable=True)
    is_late          = db.Column(db.Boolean, default=False)
    submitted_at     = db.Column(db.DateTime(timezone=True), nullable=True)
    graded_at        = db.Column(db.DateTime(timezone=True), nullable=True)
    graded_by        = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    created_at       = db.Column(db.DateTime(timezone=True), default=now_utc)
    updated_at       = db.Column(db.DateTime(timezone=True), default=now_utc, onupdate=now_utc)
    ai_score         = db.Column(db.Float, nullable=True)
    similarity_score = db.Column(db.Float, nullable=True)
    flagged          = db.Column(db.Boolean, default=False)
    assignment   = db.relationship("Assignment", back_populates="submissions")
    student      = db.relationship("User", foreign_keys=[student_id], back_populates="submissions")
    grader       = db.relationship("User", foreign_keys=[graded_by])
    group        = db.relationship("AssignmentGroup", back_populates="submission")
    edit_history = db.relationship("EditHistory", back_populates="submission", lazy="dynamic")

    def to_dict(self):
        return {
            "id":               self.id,
            "assignment_id":    self.assignment_id,
            "student_id":       self.student_id,
            "content":          self.content,
            "file_name":        self.file_name,
            "status":           self.status,
            "score":            self.score,
            "feedback":         self.feedback,
            "is_late":          self.is_late,
            "submitted_at":     self.submitted_at.isoformat() if self.submitted_at else None,
            "ai_score":         self.ai_score,
            "similarity_score": self.similarity_score,
            "flagged":          self.flagged,
            "group_id":         self.group_id,
        }

class EditHistory(db.Model):
    __tablename__ = "edit_history"
    id               = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    submission_id    = db.Column(db.String(36), db.ForeignKey("submissions.id"), nullable=False)
    user_id          = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    content_snapshot = db.Column(db.Text, nullable=False)
    char_delta       = db.Column(db.Integer, default=0)
    is_large_paste   = db.Column(db.Boolean, default=False)
    version_number   = db.Column(db.Integer, default=1)
    timestamp        = db.Column(db.DateTime(timezone=True), default=now_utc)
    submission = db.relationship("Submission", back_populates="edit_history")
    user       = db.relationship("User")

    def to_dict(self):
        return {
            "id":             self.id,
            "version_number": self.version_number,
            "char_delta":     self.char_delta,
            "is_large_paste": self.is_large_paste,
            "timestamp":      self.timestamp.isoformat(),
        }

class FocusSession(db.Model):
    __tablename__ = "focus_sessions"
    id               = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id          = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    topic_id         = db.Column(db.String(36), db.ForeignKey("topics.id"), nullable=True)
    topic_label      = db.Column(db.String(200), nullable=True)
    duration_minutes = db.Column(db.Integer, default=25)
    sessions_count   = db.Column(db.Integer, default=1)
    status           = db.Column(db.String(20), default=SessionStatus.COMPLETED)
    started_at       = db.Column(db.DateTime(timezone=True), nullable=False)
    ended_at         = db.Column(db.DateTime(timezone=True), nullable=True)
    notes            = db.Column(db.Text, nullable=True)
    created_at       = db.Column(db.DateTime(timezone=True), default=now_utc)
    user  = db.relationship("User", back_populates="focus_sessions")
    topic = db.relationship("Topic")

    def to_dict(self):
        return {
            "id":               self.id,
            "topic_label":      self.topic_label,
            "duration_minutes": self.duration_minutes,
            "sessions_count":   self.sessions_count,
            "status":           self.status,
            "started_at":       self.started_at.isoformat(),
            "ended_at":         self.ended_at.isoformat() if self.ended_at else None,
        }

class ActivityLog(db.Model):
    __tablename__ = "activity_logs"
    id          = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id     = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    project_id  = db.Column(db.String(36), db.ForeignKey("projects.id"), nullable=True, index=True)
    action_type = db.Column(db.String(50), nullable=False)
    entity_type = db.Column(db.String(50), nullable=True)
    entity_id   = db.Column(db.String(36), nullable=True)
    extra_data  = db.Column(db.JSON, nullable=True)
    timestamp   = db.Column(db.DateTime(timezone=True), default=now_utc, index=True)
    user    = db.relationship("User")
    project = db.relationship("Project")

class EngagementScore(db.Model):
    __tablename__ = "engagement_scores"
    id               = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id          = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    project_id       = db.Column(db.String(36), db.ForeignKey("projects.id"), nullable=True)
    week_start       = db.Column(db.Date, nullable=False)
    forum_score      = db.Column(db.Float, default=0.0)
    submission_score = db.Column(db.Float, default=0.0)
    resource_score   = db.Column(db.Float, default=0.0)
    quiz_score       = db.Column(db.Float, default=0.0)
    total_score      = db.Column(db.Float, default=0.0)
    calculated_at    = db.Column(db.DateTime(timezone=True), default=now_utc)
    user    = db.relationship("User", back_populates="engagement_scores")
    project = db.relationship("Project")
    __table_args__ = (db.UniqueConstraint("user_id", "project_id", "week_start"),)

    def to_dict(self):
        return {
            "week_start":       self.week_start.isoformat(),
            "forum_score":      self.forum_score,
            "submission_score": self.submission_score,
            "resource_score":   self.resource_score,
            "quiz_score":       self.quiz_score,
            "total_score":      self.total_score,
        }

class Portfolio(db.Model):
    __tablename__ = "portfolios"
    id           = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id      = db.Column(db.String(36), db.ForeignKey("users.id"), unique=True, nullable=False)
    bio          = db.Column(db.Text, nullable=True)
    github_url   = db.Column(db.String(500), nullable=True)
    linkedin_url = db.Column(db.String(500), nullable=True)
    skills       = db.Column(db.JSON, default=list)
    updated_at   = db.Column(db.DateTime(timezone=True), default=now_utc, onupdate=now_utc)
    user     = db.relationship("User", back_populates="portfolio")
    projects = db.relationship("PortfolioProject", back_populates="portfolio", lazy="dynamic")

    def to_dict(self):
        return {
            "id":           self.id,
            "user_id":      self.user_id,
            "bio":          self.bio,
            "github_url":   self.github_url,
            "linkedin_url": self.linkedin_url,
            "skills":       self.skills or [],
            "updated_at":   self.updated_at.isoformat(),
        }

class PortfolioProject(db.Model):
    __tablename__ = "portfolio_projects"
    id           = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    portfolio_id = db.Column(db.String(36), db.ForeignKey("portfolios.id"), nullable=False)
    project_id   = db.Column(db.String(36), db.ForeignKey("projects.id"), nullable=True)
    title        = db.Column(db.String(200), nullable=False)
    description  = db.Column(db.Text, nullable=True)
    role         = db.Column(db.String(100), nullable=True)
    is_featured  = db.Column(db.Boolean, default=False)
    created_at   = db.Column(db.DateTime(timezone=True), default=now_utc)
    portfolio = db.relationship("Portfolio", back_populates="projects")

    def to_dict(self):
        return {
            "id":          self.id,
            "title":       self.title,
            "description": self.description,
            "role":        self.role,
            "is_featured": self.is_featured,
        }

class RiskProfile(db.Model):
    __tablename__ = "risk_profiles"
    id                   = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id              = db.Column(db.String(36), db.ForeignKey("users.id"), unique=True, nullable=False)
    risk_level           = db.Column(db.String(10), default=RiskLevel.LOW)
    attendance_score     = db.Column(db.Float, default=100.0)
    grade_trend          = db.Column(db.String(10), default="stable")
    late_submission_count = db.Column(db.Integer, default=0)
    predicted_grade      = db.Column(db.Float, nullable=True)
    flags                = db.Column(db.JSON, default=list)
    last_calculated      = db.Column(db.DateTime(timezone=True), default=now_utc)
    user = db.relationship("User", back_populates="risk_profile")

    def to_dict(self):
        return {
            "risk_level":             self.risk_level,
            "attendance_score":       self.attendance_score,
            "grade_trend":            self.grade_trend,
            "late_submission_count":  self.late_submission_count,
            "predicted_grade":        self.predicted_grade,
            "flags":                  self.flags or [],
            "last_calculated":        self.last_calculated.isoformat(),
        }

class GradeRecord(db.Model):
    __tablename__ = "grade_records"
    id            = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id       = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    submission_id = db.Column(db.String(36), db.ForeignKey("submissions.id"), nullable=False)
    score         = db.Column(db.Float, nullable=False)
    max_score     = db.Column(db.Float, default=100.0)
    percentage    = db.Column(db.Float, nullable=False)
    recorded_at   = db.Column(db.DateTime(timezone=True), default=now_utc)
    user       = db.relationship("User")
    submission = db.relationship("Submission")

class Certificate(db.Model):
    __tablename__ = "certificates"
    id                = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id           = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    project_id        = db.Column(db.String(36), db.ForeignKey("projects.id"), nullable=True)
    title             = db.Column(db.String(300), nullable=False)
    grade             = db.Column(db.String(5), nullable=True)
    study_hours       = db.Column(db.Float, default=0.0)
    verification_code = db.Column(db.String(50), unique=True, nullable=False)
    file_path         = db.Column(db.String(500), nullable=True)
    issued_at         = db.Column(db.DateTime(timezone=True), default=now_utc)
    is_valid          = db.Column(db.Boolean, default=True)
    user    = db.relationship("User", back_populates="certificates")
    project = db.relationship("Project")

    def to_dict(self):
        return {
            "id":                self.id,
            "title":             self.title,
            "grade":             self.grade,
            "study_hours":       self.study_hours,
            "verification_code": self.verification_code,
            "issued_at":         self.issued_at.isoformat(),
            "is_valid":          self.is_valid,
        }

class Notification(db.Model):
    __tablename__ = "notifications"
    id          = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id     = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    title       = db.Column(db.String(200), nullable=False)
    message     = db.Column(db.Text, nullable=False)
    type        = db.Column(db.String(50), default="info")
    entity_type = db.Column(db.String(50), nullable=True)
    entity_id   = db.Column(db.String(36), nullable=True)
    is_read     = db.Column(db.Boolean, default=False)
    created_at  = db.Column(db.DateTime(timezone=True), default=now_utc)
    user = db.relationship("User", back_populates="notifications")

    def to_dict(self):
        return {
            "id":         self.id,
            "title":      self.title,
            "message":    self.message,
            "type":       self.type,
            "is_read":    self.is_read,
            "created_at": self.created_at.isoformat(),
        }


# ── Courses ───────────────────────────────────────────────────────────────────

class Course(db.Model):
    __tablename__ = "courses"
    id            = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    code          = db.Column(db.String(20), unique=True, nullable=False)
    title         = db.Column(db.String(200), nullable=False)
    description   = db.Column(db.Text, nullable=True)
    credits       = db.Column(db.Integer, default=3)
    topic_keyword = db.Column(db.String(100), nullable=True)
    instructor_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    created_at    = db.Column(db.DateTime(timezone=True), default=now_utc)

    instructor  = db.relationship("User", foreign_keys=[instructor_id])
    enrollments = db.relationship("CourseEnrollment", back_populates="course", lazy="dynamic")
    time_logs   = db.relationship("TimeLog", back_populates="course", lazy="dynamic")

    def to_dict(self):
        return {
            "id":            self.id,
            "code":          self.code,
            "title":         self.title,
            "description":   self.description,
            "credits":       self.credits,
            "topic_keyword": self.topic_keyword,
            "instructor":    self.instructor.full_name if self.instructor else None,
        }


class CourseEnrollment(db.Model):
    __tablename__ = "course_enrollments"
    id          = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    course_id   = db.Column(db.String(36), db.ForeignKey("courses.id"), nullable=False)
    student_id  = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    enrolled_at = db.Column(db.DateTime(timezone=True), default=now_utc)

    course  = db.relationship("Course", back_populates="enrollments")
    student = db.relationship("User")
    __table_args__ = (db.UniqueConstraint("course_id", "student_id"),)


# ── Time Logs ─────────────────────────────────────────────────────────────────

class TimeLog(db.Model):
    __tablename__ = "time_logs"
    id            = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id       = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    course_id     = db.Column(db.String(36), db.ForeignKey("courses.id"), nullable=True)
    assignment_id = db.Column(db.String(36), db.ForeignKey("assignments.id"), nullable=True)
    description   = db.Column(db.String(300), nullable=True)
    minutes       = db.Column(db.Integer, nullable=False)
    log_type      = db.Column(db.String(20), default="study")  # study | assignment
    logged_at     = db.Column(db.Date, nullable=False)
    created_at    = db.Column(db.DateTime(timezone=True), default=now_utc)

    user       = db.relationship("User")
    course     = db.relationship("Course", back_populates="time_logs")
    assignment = db.relationship("Assignment")

    def to_dict(self):
        return {
            "id":            self.id,
            "course_id":     self.course_id,
            "assignment_id": self.assignment_id,
            "description":   self.description,
            "minutes":       self.minutes,
            "log_type":      self.log_type,
            "logged_at":     self.logged_at.isoformat() if self.logged_at else None,
            "course_title":  self.course.title if self.course else None,
        }