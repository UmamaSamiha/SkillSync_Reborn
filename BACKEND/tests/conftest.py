"""
Shared pytest fixtures for the SkillSync backend test suite.

These are integration tests: they run against the app's real database
(whatever DATABASE_URL points to — the dev Postgres DB) using Flask's
test client, and the seeded demo accounts from app/seed.py. Every fixture
that creates data cleans it up itself so the suite can be re-run freely
without accumulating junk rows.
"""
import os
import uuid
import pytest

from app import create_app, db as _db

ADMIN_EMAIL   = "admin@skillsync.edu"
TEACHER_EMAIL = "teacher@skillsync.edu"
STUDENT_EMAIL = "tahmina@skillsync.edu"   # will be enrolled in the test course
OTHER_STUDENT_EMAIL = "parisa@skillsync.edu"  # deliberately left unenrolled
SEED_PASSWORD = "password123"


@pytest.fixture(scope="session")
def app():
    flask_app = create_app("development")
    flask_app.config["TESTING"] = True
    return flask_app


@pytest.fixture()
def client(app):
    return app.test_client()


def _login(client, email, password=SEED_PASSWORD):
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"login failed for {email}: {res.get_json()}"
    return res.get_json()["data"]["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def tokens(app):
    with app.test_client() as client:
        return {
            "admin":   _login(client, ADMIN_EMAIL),
            "teacher": _login(client, TEACHER_EMAIL),
            "student": _login(client, STUDENT_EMAIL),
            "other_student": _login(client, OTHER_STUDENT_EMAIL),
        }


@pytest.fixture(scope="session")
def user_ids(app):
    with app.app_context():
        from app.models import User
        return {
            "student": User.query.filter_by(email=STUDENT_EMAIL).first().id,
            "other_student": User.query.filter_by(email=OTHER_STUDENT_EMAIL).first().id,
        }


def _hard_delete_course(app, course_id):
    """Fully remove a test course and everything hanging off it."""
    with app.app_context():
        from app.models import (
            Course, CourseEnrollment, Resource, AnushkaTopic, AnushkaQuestionBank,
            AnushkaSubmission, Certificate, Project, ProjectMember,
        )

        CourseEnrollment.query.filter_by(course_id=course_id).delete()

        for r in Resource.query.filter_by(course_id=course_id).all():
            if r.file_path:
                full = os.path.abspath(os.path.join(app.config["UPLOAD_FOLDER"], r.file_path))
                if os.path.exists(full):
                    os.remove(full)
            _db.session.delete(r)

        topics = AnushkaTopic.query.filter_by(course_id=course_id).all()
        topic_ids = [t.id for t in topics]
        if topic_ids:
            for s in AnushkaSubmission.query.filter(AnushkaSubmission.topic_id.in_(topic_ids)).all():
                _db.session.delete(s)  # cascades AnushkaEditEvent
        for t in topics:
            _db.session.delete(t)  # cascades prerequisites + progress_records

        for b in AnushkaQuestionBank.query.filter_by(course_id=course_id).all():
            _db.session.delete(b)  # cascades questions

        for c in Certificate.query.filter_by(course_id=course_id).all():
            if c.file_path:
                full = os.path.abspath(c.file_path)
                if os.path.exists(full):
                    os.remove(full)
            _db.session.delete(c)

        for p in Project.query.filter_by(course_id=course_id).all():
            ProjectMember.query.filter_by(project_id=p.id).delete()
            _db.session.delete(p)

        course = Course.query.get(course_id)
        if course:
            _db.session.delete(course)

        _db.session.commit()


@pytest.fixture()
def test_course(app, tokens):
    """A fresh, isolated course owned by the seeded teacher account.
    Teacher-created courses start pending_approval, but enrollment,
    resources, question banks and roadmap steps don't require active
    status, so that's fine for testing.
    """
    with app.test_client() as client:
        code = f"TST{uuid.uuid4().hex[:6].upper()}"
        res = client.post("/api/courses/", headers=auth_headers(tokens["teacher"]), json={
            "code": code, "title": f"Test Course {code}", "credits": 3,
        })
        assert res.status_code == 201, res.get_json()
        course = res.get_json()["data"]

    yield course
    _hard_delete_course(app, course["id"])


@pytest.fixture()
def enrolled_student(app, tokens, test_course, user_ids):
    """Enrolls the STUDENT_EMAIL account in test_course; unenrolls at teardown."""
    with app.test_client() as client:
        res = client.post(f"/api/courses/{test_course['id']}/enroll", headers=auth_headers(tokens["student"]))
        assert res.status_code == 200, res.get_json()
    yield tokens["student"]
    with app.app_context():
        from app.models import CourseEnrollment
        CourseEnrollment.query.filter_by(
            course_id=test_course["id"], student_id=user_ids["student"]
        ).delete()
        _db.session.commit()
