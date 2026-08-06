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

class RiskLevel:
    LOW    = "low"
    MEDIUM = "medium"
    HIGH   = "high"

class DifficultyLevel:
    BEGINNER     = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED     = "advanced"

class LiveClassStatus:
    SCHEDULED = "scheduled"
    LIVE      = "live"
    ENDED     = "ended"
    CANCELED  = "canceled"

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
    course_id   = db.Column(db.String(36), db.ForeignKey("courses.id"), nullable=True)
    created_by  = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    is_active   = db.Column(db.Boolean, default=True)
    start_date  = db.Column(db.Date, nullable=True)
    end_date    = db.Column(db.Date, nullable=True)
    created_at  = db.Column(db.DateTime(timezone=True), default=now_utc)
    updated_at  = db.Column(db.DateTime(timezone=True), default=now_utc, onupdate=now_utc)
    members     = db.relationship("ProjectMember", back_populates="project", lazy="dynamic")
    assignments = db.relationship("Assignment", back_populates="project", lazy="dynamic")
    creator     = db.relationship("User", foreign_keys=[created_by])
    course      = db.relationship("Course", back_populates="projects")

    def to_dict(self):
        return {
            "id":           self.id,
            "name":         self.name,
            "description":  self.description,
            "course_id":    self.course_id,
            "course_title": self.course.title if self.course else None,
            "course_code":  self.course.code  if self.course else None,
            "created_by":   self.created_by,
            "is_active":    self.is_active,
            "start_date":   self.start_date.isoformat() if self.start_date else None,
            "end_date":     self.end_date.isoformat() if self.end_date else None,
            "created_at":   self.created_at.isoformat(),
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
    # ── AI scan results (one-to-many so history is kept) ──────────
    scans        = db.relationship("SubmissionScan", back_populates="submission", lazy="dynamic")

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


# ── NEW: SubmissionScan — stores every AI/similarity scan result ──────────────

class SubmissionScan(db.Model):
    """
    Stores each AI + similarity detection scan for a submission.
    Multiple scans per submission are allowed (history is kept).
    """
    __tablename__ = "submission_scans"
    id               = db.Column(db.Integer, primary_key=True, autoincrement=True)
    submission_id    = db.Column(db.String(36), db.ForeignKey("submissions.id"), nullable=False, index=True)
    ai_score         = db.Column(db.Numeric(5, 2), nullable=True)   # 0.00–100.00
    similarity_score = db.Column(db.Numeric(5, 2), nullable=True)   # 0.00–100.00
    status           = db.Column(db.String(50), default="completed")
    scanned_at       = db.Column(db.DateTime(timezone=True), default=now_utc)
    submission       = db.relationship("Submission", back_populates="scans")

    def to_dict(self):
        return {
            "id":               self.id,
            "submission_id":    self.submission_id,
            "ai_score":         float(self.ai_score)         if self.ai_score         else None,
            "similarity_score": float(self.similarity_score) if self.similarity_score else None,
            "status":           self.status,
            "scanned_at":       self.scanned_at.isoformat(),
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

class CourseStatus:
    ACTIVE            = "active"
    PENDING_APPROVAL  = "pending_approval"   # teacher created it, awaiting admin sign-off
    PENDING_DELETION  = "pending_deletion"   # teacher requested removal, awaiting admin sign-off
    DELETED           = "deleted"            # admin approved removal (soft-deleted)


class Course(db.Model):
    __tablename__ = "courses"
    id            = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    code          = db.Column(db.String(20), unique=True, nullable=False)
    title         = db.Column(db.String(200), nullable=False)
    description   = db.Column(db.Text, nullable=True)
    credits       = db.Column(db.Integer, default=3)
    topic_keyword = db.Column(db.String(100), nullable=True)
    instructor_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    status        = db.Column(db.String(20), default=CourseStatus.ACTIVE, nullable=False)
    created_at    = db.Column(db.DateTime(timezone=True), default=now_utc)

    instructor  = db.relationship("User", foreign_keys=[instructor_id])
    enrollments = db.relationship("CourseEnrollment", back_populates="course", lazy="dynamic")
    time_logs   = db.relationship("TimeLog", back_populates="course", lazy="dynamic")
    projects    = db.relationship("Project", back_populates="course", lazy="dynamic")

    def to_dict(self):
        return {
            "id":            self.id,
            "code":          self.code,
            "title":         self.title,
            "description":   self.description,
            "credits":       self.credits,
            "topic_keyword": self.topic_keyword,
            "instructor_id": self.instructor_id,
            "instructor":    self.instructor.full_name if self.instructor else None,
            "status":        self.status,
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


# ── Live Classes ──────────────────────────────────────────────────────────────

class LiveClass(db.Model):
    __tablename__ = "live_classes"
    id            = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    course_id     = db.Column(db.String(36), db.ForeignKey("courses.id"), nullable=False, index=True)
    host_id       = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    title         = db.Column(db.String(200), nullable=False)
    description   = db.Column(db.Text, nullable=True)
    room_slug     = db.Column(db.String(64), unique=True, nullable=False, default=gen_uuid)
    status        = db.Column(db.String(20), default=LiveClassStatus.SCHEDULED, nullable=False, index=True)
    scheduled_at  = db.Column(db.DateTime(timezone=True), nullable=False)
    started_at    = db.Column(db.DateTime(timezone=True), nullable=True)
    ended_at      = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at    = db.Column(db.DateTime(timezone=True), default=now_utc)

    course     = db.relationship("Course")
    host       = db.relationship("User", foreign_keys=[host_id])
    attendance = db.relationship("LiveClassAttendance", back_populates="live_class",
                                  lazy="dynamic", cascade="all, delete-orphan")

    def to_dict(self, current_user_id=None):
        data = {
            "id":            self.id,
            "course_id":     self.course_id,
            "course_code":   self.course.code if self.course else None,
            "course_title":  self.course.title if self.course else None,
            "host_id":       self.host_id,
            "host_name":     self.host.full_name if self.host else None,
            "title":         self.title,
            "description":   self.description,
            "room_slug":     self.room_slug,
            "status":        self.status,
            "scheduled_at":  self.scheduled_at.isoformat() if self.scheduled_at else None,
            "started_at":    self.started_at.isoformat() if self.started_at else None,
            "ended_at":      self.ended_at.isoformat() if self.ended_at else None,
            "attendee_count": self.attendance.filter_by(left_at=None).count()
                               if self.status == LiveClassStatus.LIVE else self.attendance.count(),
        }
        if current_user_id:
            data["is_host"] = self.host_id == current_user_id
        return data


class LiveClassAttendance(db.Model):
    __tablename__ = "live_class_attendance"
    id            = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    live_class_id = db.Column(db.String(36), db.ForeignKey("live_classes.id"), nullable=False, index=True)
    user_id       = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    joined_at     = db.Column(db.DateTime(timezone=True), default=now_utc)
    left_at       = db.Column(db.DateTime(timezone=True), nullable=True)

    live_class = db.relationship("LiveClass", back_populates="attendance")
    user       = db.relationship("User")

    def duration_minutes(self):
        end = self.left_at or now_utc()
        if not self.joined_at:
            return 0
        return round((end - self.joined_at).total_seconds() / 60, 1)

    def to_dict(self):
        return {
            "id":              self.id,
            "user_id":         self.user_id,
            "user_name":       self.user.full_name if self.user else None,
            "joined_at":       self.joined_at.isoformat() if self.joined_at else None,
            "left_at":         self.left_at.isoformat() if self.left_at else None,
            "duration_minutes": self.duration_minutes(),
        }


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
# ── Anushka: Curriculum Models ────────────────────────────────────────────────

class AnushkaTopic(db.Model):
    __tablename__ = "anushka_topics"

    id                = db.Column(db.Integer, primary_key=True)
    title             = db.Column(db.String(255), nullable=False)
    description       = db.Column(db.Text, nullable=True)
    track             = db.Column(db.String(100), nullable=False, default="General")
    order             = db.Column(db.Integer, nullable=False, default=0)
    mastery_threshold = db.Column(db.Integer, nullable=False, default=80)

    prerequisites    = db.relationship(
        "AnushkaTopicPrerequisite",
        foreign_keys="AnushkaTopicPrerequisite.topic_id",
        backref="topic",
        lazy=True,
        cascade="all, delete-orphan",
    )
    progress_records = db.relationship(
        "AnushkaUserTopicProgress",
        backref="topic",
        lazy=True,
        cascade="all, delete-orphan"
    )

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


class AnushkaTopicPrerequisite(db.Model):
    __tablename__ = "anushka_topic_prerequisites"

    id              = db.Column(db.Integer, primary_key=True)
    topic_id        = db.Column(db.Integer, db.ForeignKey("anushka_topics.id"), nullable=False)
    prerequisite_id = db.Column(db.Integer, db.ForeignKey("anushka_topics.id"), nullable=False)

    __table_args__ = (db.UniqueConstraint("topic_id", "prerequisite_id"),)


class AnushkaUserTopicProgress(db.Model):
    __tablename__ = "anushka_user_topic_progress"

    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    topic_id   = db.Column(db.Integer, db.ForeignKey("anushka_topics.id"), nullable=False)
    status     = db.Column(db.String(20), nullable=False, default="locked")
    quiz_score = db.Column(db.Integer, nullable=True)
    attempts   = db.Column(db.Integer, nullable=False, default=0)
    updated_at = db.Column(db.DateTime(timezone=True), default=now_utc)

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


# ── Anushka: Question Bank Models ─────────────────────────────────────────────

class AnushkaQuestionBank(db.Model):
    __tablename__ = "anushka_question_banks"

    id          = db.Column(db.Integer, primary_key=True)
    title       = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    track       = db.Column(db.String(100), nullable=True)
    course_id   = db.Column(db.String(36), db.ForeignKey("courses.id"), nullable=True)
    created_by  = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    created_at  = db.Column(db.DateTime(timezone=True), default=now_utc)

    course = db.relationship("Course")
    questions = db.relationship(
        "AnushkaQuestion",
        backref="bank",
        lazy=True,
        cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id":          self.id,
            "title":       self.title,
            "description": self.description,
            "track":       self.track,
            "course_id":   self.course_id,
            "course_code": self.course.code if self.course else None,
            "course_title": self.course.title if self.course else None,
            "created_by":  self.created_by,
            "created_at":  self.created_at.isoformat() if self.created_at else None,
        }


class AnushkaQuestion(db.Model):
    __tablename__ = "anushka_questions"

    id          = db.Column(db.Integer, primary_key=True)
    bank_id     = db.Column(db.Integer, db.ForeignKey("anushka_question_banks.id"), nullable=False)
    text        = db.Column(db.Text, nullable=False)
    q_type      = db.Column(db.String(20), nullable=False, default="mcq")
    difficulty  = db.Column(db.String(20), nullable=False, default="beginner")
    options     = db.Column(db.JSON, nullable=True)
    correct     = db.Column(db.String(255), nullable=True)
    explanation = db.Column(db.Text, nullable=True)
    created_at  = db.Column(db.DateTime(timezone=True), default=now_utc)

    def to_dict(self):
        return {
            "id":             self.id,
            "bank_id":        self.bank_id,
            "text":           self.text,
            "q_type":         self.q_type,
            "question_type":  self.q_type,
            "difficulty":     self.difficulty,
            "options":        self.options,
            "correct":        self.correct,
            "correct_answer": self.correct,
            "explanation":    self.explanation,
        }


# ── Anushka: Edit Tracking Models ─────────────────────────────────────────────

class AnushkaSubmission(db.Model):
    __tablename__ = "anushka_submissions"

    id            = db.Column(db.Integer, primary_key=True)
    user_id       = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    title         = db.Column(db.String(255), nullable=False)
    content_type  = db.Column(db.String(50), nullable=False, default="quiz")
    topic_name    = db.Column(db.String(255), nullable=True)
    topic_id      = db.Column(db.Integer, db.ForeignKey("anushka_topics.id"), nullable=True)
    final_text    = db.Column(db.Text, nullable=True)
    ai_score      = db.Column(db.Float, nullable=True)
    ai_flagged    = db.Column(db.Boolean, default=False)
    teacher_score = db.Column(db.Integer, nullable=True)
    scored_by     = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    scored_at     = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at    = db.Column(db.DateTime(timezone=True), default=now_utc)
    updated_at    = db.Column(db.DateTime(timezone=True), default=now_utc)

    edits  = db.relationship("AnushkaEditEvent", backref="submission", lazy=True, cascade="all, delete-orphan")
    user   = db.relationship("User", foreign_keys=[user_id], backref="anushka_submissions", lazy=True)
    scorer = db.relationship("User", foreign_keys=[scored_by], lazy=True)

    def to_dict(self):
        return {
            "id":            self.id,
            "user_id":       self.user_id,
            "user_name":     self.user.full_name if self.user else None,
            "user_email":    self.user.email if self.user else None,
            "title":         self.title,
            "content_type":  self.content_type,
            "topic_name":    self.topic_name,
            "final_text":    self.final_text,
            "ai_score":      self.ai_score,
            "ai_flagged":    self.ai_flagged,
            "teacher_score": self.teacher_score,
            "scored_by":     self.scorer.full_name if self.scorer else None,
            "scored_at":     self.scored_at.isoformat() if self.scored_at else None,
            "created_at":    self.created_at.isoformat() if self.created_at else None,
            "updated_at":    self.updated_at.isoformat() if self.updated_at else None,
            "edit_count":    len(self.edits),
        }


class AnushkaEditEvent(db.Model):
    __tablename__ = "anushka_edit_events"

    id            = db.Column(db.Integer, primary_key=True)
    submission_id = db.Column(db.Integer, db.ForeignKey("anushka_submissions.id"), nullable=False)
    text_snapshot = db.Column(db.Text, nullable=False)
    chars_added   = db.Column(db.Integer, nullable=False, default=0)
    chars_removed = db.Column(db.Integer, nullable=False, default=0)
    is_paste      = db.Column(db.Boolean, default=False)
    created_at    = db.Column(db.DateTime(timezone=True), default=now_utc)

    def to_dict(self):
        return {
            "id":            self.id,
            "submission_id": self.submission_id,
            "text_snapshot": self.text_snapshot,
            "chars_added":   self.chars_added,
            "chars_removed": self.chars_removed,
            "is_paste":      self.is_paste,
            "created_at":    self.created_at.isoformat() if self.created_at else None,
        }
