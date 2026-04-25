"""
SkillSync — Sample Data Seeder
================================
Run with: flask seed
Creates demo users, projects, assignments, sessions, and activity logs.
All grades are dynamically generated with realistic time sequences.
Risk profiles use the actual risk_engine service.
"""

from datetime import datetime, timezone, timedelta, date
import random
from app import db, bcrypt
from app.models import (
    User, Project, ProjectMember, Topic, Assignment, Submission,
    FocusSession, ActivityLog, EngagementScore, Portfolio,
    PortfolioProject, GradeRecord, RiskProfile, Certificate,
    Notification, EditHistory, SubmissionStatus, SessionStatus,
    Role, DifficultyLevel, Course, CourseEnrollment, TimeLog
)


# ── Student profiles: defines realistic grade patterns ───────────────────────
# Each profile has a starting grade, direction, and volatility
STUDENT_PROFILES = [
    # name, email, pattern, start_grade, end_grade, late_ratio, focus_multiplier
    ("Anushka Ahmed",  "anushka@skillsync.edu",  "rising",   70, 92, 0.0, 1.4),
    ("Tahmina Akhter", "tahmina@skillsync.edu",  "rising",   65, 82, 0.1, 1.2),
    ("Parisa Rahman",  "parisa@skillsync.edu",   "stable",   88, 93, 0.0, 1.5),
    ("Umaima Samiha",  "samiha@skillsync.edu",   "falling",  75, 55, 0.3, 0.7),
    ("Nila Islam",     "nila@skillsync.edu",      "falling",  55, 38, 0.5, 0.4),
]


def _gen_grades(pattern, start, end, count):
    """
    Generate a realistic grade sequence based on pattern.
    rising: grades improve over time
    falling: grades decline over time
    stable: grades stay consistent with minor variance
    """
    grades = []
    for i in range(count):
        progress = i / max(count - 1, 1)

        if pattern == "rising":
            base = start + (end - start) * progress
        elif pattern == "falling":
            base = start + (end - start) * progress
        else:  # stable
            base = (start + end) / 2

        # Add realistic noise
        noise = random.uniform(-6, 6)
        grade = round(min(100, max(20, base + noise)))
        grades.append(grade)

    return grades


def seed_all():
    """Drop all tables and re-seed with fresh sample data."""
    print("Seeding SkillSync database...")
    db.drop_all()
    db.create_all()

    # ── Users ─────────────────────────────────────────────────────────────
    pw = bcrypt.generate_password_hash("password123").decode("utf-8")

    admin = User(
        email="admin@skillsync.edu", password_hash=pw,
        full_name="Dr. Admin", role=Role.ADMIN
    )
    teacher = User(
        email="teacher@skillsync.edu", password_hash=pw,
        full_name="Prof. Rahman", role=Role.TEACHER
    )

    students = []
    for name, email, *_ in STUDENT_PROFILES:
        s = User(email=email, password_hash=pw, full_name=name, role=Role.STUDENT)
        students.append(s)

    db.session.add_all([admin, teacher] + students)
    db.session.flush()

    # ── Project ───────────────────────────────────────────────────────────
    project = Project(
        name        = "SkillSync LMS",
        description = "University LMS platform — group capstone project",
        course_code = "CSE499B",
        created_by  = teacher.id,
        start_date  = date(2026, 1, 1),
        end_date    = date(2026, 6, 30),
    )
    db.session.add(project)
    db.session.flush()

    # ── Members ───────────────────────────────────────────────────────────
    for i, s in enumerate(students):
        db.session.add(ProjectMember(
            project_id    = project.id,
            user_id       = s.id,
            role_in_group = "lead" if i == 0 else "member",
        ))

    # ── Topics ────────────────────────────────────────────────────────────
    topics = []
    topic_defs = [
        ("Database Systems", DifficultyLevel.BEGINNER),
        ("Algorithms",       DifficultyLevel.INTERMEDIATE),
        ("System Design",    DifficultyLevel.INTERMEDIATE),
        ("Networks",         DifficultyLevel.ADVANCED),
    ]
    for i, (name, diff) in enumerate(topic_defs):
        t = Topic(
            project_id      = project.id,
            title           = name,
            order_index     = i,
            difficulty      = diff,
            prerequisite_id = topics[i - 1].id if i > 0 else None,
            mastery_score   = 70.0,
        )
        db.session.add(t)
        db.session.flush()
        topics.append(t)

    # ── Courses ───────────────────────────────────────────────────────────
    course_defs = [
        ("CS101",  "Introduction to Programming",    "Learn Python fundamentals, control flow, and basic data structures.", 3, "python programming beginner"),
        ("CS201",  "Data Structures and Algorithms", "Arrays, linked lists, trees, sorting, and complexity analysis.",      3, "data structures algorithms"),
        ("CS301",  "Database Systems",               "Relational models, SQL, normalization, and transaction management.",  3, "database systems SQL"),
        ("CS401",  "Computer Networks",              "OSI model, TCP/IP, routing protocols, and network security.",         3, "computer networks TCP IP"),
        ("CS499B", "Software Engineering Capstone",  "Full-stack development of a real-world LMS platform as a team.",     4, "software engineering agile"),
    ]
    courses = []
    for code, title, desc, credits, keyword in course_defs:
        c = Course(
            code=code, title=title, description=desc,
            credits=credits, topic_keyword=keyword,
            instructor_id=teacher.id,
        )
        db.session.add(c)
        db.session.flush()
        courses.append(c)

    for student in students:
        for course in courses:
            db.session.add(CourseEnrollment(course_id=course.id, student_id=student.id))

    # ── Assignments ───────────────────────────────────────────────────────
    assignment_defs = [
        ("ER Diagram Design",      topics[0].id, date(2026, 1, 20), False),
        ("SQL Query Optimization", topics[0].id, date(2026, 2, 5),  False),
        ("Sorting Algorithm",      topics[1].id, date(2026, 2, 20), False),
        ("System Design Report",   topics[2].id, date(2026, 3, 5),  True),
        ("Network Protocols",      topics[3].id, date(2026, 3, 20), True),
        ("Database Normalization", topics[0].id, date(2026, 4, 1),  False),
    ]

    assignments = []
    for title, topic_id, due, is_group in assignment_defs:
        a = Assignment(
            project_id  = project.id,
            topic_id    = topic_id,
            created_by  = teacher.id,
            title       = title,
            description = f"Complete the {title} assignment as per course guidelines.",
            due_date    = datetime.combine(due, datetime.min.time()).replace(tzinfo=timezone.utc),
            max_score   = 100.0,
            is_group    = is_group,
        )
        db.session.add(a)
        db.session.flush()
        assignments.append(a)

    n_assignments = len(assignments)

    # ── Submissions & Grade Records ───────────────────────────────────────
    # Grades are spaced over time so trend calculation works correctly
    base_date = datetime.now(timezone.utc) - timedelta(days=n_assignments * 12)

    for idx, student in enumerate(students):
        _, _, pattern, start, end, late_ratio, _ = STUDENT_PROFILES[idx]

        grades = _gen_grades(pattern, start, end, n_assignments)

        for i, assignment in enumerate(assignments):
            score    = grades[i]
            # Space submissions evenly over time so trend is meaningful
            sub_date = base_date + timedelta(days=i * 12 + random.randint(0, 3))
            grade_date = sub_date + timedelta(days=random.randint(1, 3))

            is_late = (
                random.random() < late_ratio and
                assignment.due_date and
                sub_date > assignment.due_date
            )

            sub = Submission(
                assignment_id = assignment.id,
                student_id    = student.id,
                content       = f"Submission for {assignment.title} by {student.full_name}.",
                status        = SubmissionStatus.GRADED,
                score         = float(score),
                feedback      = f"Score: {score}/100. {'Good effort.' if score >= 70 else 'Needs improvement.'}",
                is_late       = is_late,
                submitted_at  = sub_date,
                graded_at     = grade_date,
                graded_by     = teacher.id,
                ai_score      = round(random.uniform(0.05, 0.30), 3),
            )
            db.session.add(sub)
            db.session.flush()

            # GradeRecord — recorded_at matches graded_at for correct trend ordering
            gr = GradeRecord(
                user_id       = student.id,
                submission_id = sub.id,
                score         = float(score),
                max_score     = 100.0,
                percentage    = float(score),
                recorded_at   = grade_date,
            )
            db.session.add(gr)

            db.session.add(EditHistory(
                submission_id    = sub.id,
                user_id          = student.id,
                content_snapshot = sub.content,
                char_delta       = len(sub.content),
                is_large_paste   = False,
                version_number   = 1,
            ))

    # ── Focus Sessions ────────────────────────────────────────────────────
    topic_labels = ["Database Systems", "Algorithms", "System Design", "Networks", "General Study"]

    for idx, student in enumerate(students):
        _, _, _, _, _, _, focus_mult = STUDENT_PROFILES[idx]
        base_sessions = int(3 * focus_mult)

        for day_offset in range(21):
            day         = datetime.now(timezone.utc) - timedelta(days=day_offset)
            num_sessions = max(0, int(random.gauss(base_sessions, 1)))

            for _ in range(num_sessions):
                duration = random.choice([25, 25, 50, 50, 90])
                started  = day.replace(hour=random.randint(9, 20), minute=0, second=0)

                db.session.add(FocusSession(
                    user_id          = student.id,
                    topic_label      = random.choice(topic_labels),
                    duration_minutes = duration,
                    sessions_count   = max(1, duration // 25),
                    status           = random.choices(
                        [SessionStatus.COMPLETED, SessionStatus.INTERRUPTED],
                        weights=[0.85, 0.15]
                    )[0],
                    started_at = started,
                    ended_at   = started + timedelta(minutes=duration),
                ))

    # ── Activity Logs ─────────────────────────────────────────────────────
    action_types = [
        "file_upload", "submission", "forum_post",
        "quiz_attempt", "resource_access", "focus_session", "login"
    ]
    # activity_weight maps to engagement level per student profile
    activity_weights = [5, 4, 5, 2, 1]

    for idx, student in enumerate(students):
        w = activity_weights[idx]
        for day_offset in range(21):
            day    = datetime.now(timezone.utc) - timedelta(days=day_offset)
            n_logs = max(0, int(random.gauss(w, 1.5)))

            for _ in range(n_logs):
                db.session.add(ActivityLog(
                    user_id     = student.id,
                    project_id  = project.id,
                    action_type = random.choice(action_types),
                    timestamp   = day.replace(
                        hour=random.randint(8, 22),
                        minute=random.randint(0, 59)
                    ),
                ))

    # ── Engagement Scores ─────────────────────────────────────────────────
    for idx, student in enumerate(students):
        w = activity_weights[idx]
        for week_offset in range(6):
            week_start = (datetime.now(timezone.utc) - timedelta(weeks=week_offset)).date()
            scale      = w / 5.0
            db.session.add(EngagementScore(
                user_id          = student.id,
                project_id       = project.id,
                week_start       = week_start,
                forum_score      = round(random.uniform(5, 40) * scale, 1),
                submission_score = round(random.uniform(10, 50) * scale, 1),
                resource_score   = round(random.uniform(5, 30) * scale, 1),
                quiz_score       = round(random.uniform(5, 25) * scale, 1),
                total_score      = round(random.uniform(25, 145) * scale, 1),
            ))

    # ── Portfolios ────────────────────────────────────────────────────────
    skill_sets = [
        ["Python", "Flask", "PostgreSQL", "React", "Docker"],
        ["Python", "ML", "TensorFlow", "Data Analysis"],
        ["Java", "Spring Boot", "AWS", "Microservices"],
        ["JavaScript", "Node.js", "MongoDB", "Express"],
        ["C++", "Algorithms", "System Programming"],
    ]

    for idx, student in enumerate(students):
        p = Portfolio(
            user_id = student.id,
            bio     = "Computer Science student passionate about software engineering.",
            skills  = skill_sets[idx],
        )
        db.session.add(p)
        db.session.flush()

        db.session.add(PortfolioProject(
            portfolio_id = p.id,
            project_id   = project.id,
            title        = "SkillSync LMS",
            description  = "University Learning Management System with analytics.",
            role         = "Full Stack Developer",
            is_featured  = True,
        ))

    # ── Time Logs ─────────────────────────────────────────────────────────
    for idx, student in enumerate(students):
        _, _, _, _, _, _, focus_mult = STUDENT_PROFILES[idx]
        for day_offset in range(21):
            log_date = (datetime.now(timezone.utc) - timedelta(days=day_offset)).date()
            # 1-3 study sessions per day linked to random courses
            for _ in range(random.randint(1, 3)):
                mins = random.choice([25, 30, 45, 50, 60, 90])
                db.session.add(TimeLog(
                    user_id   = student.id,
                    course_id = random.choice(courses).id,
                    description = "Study session",
                    minutes   = int(mins * focus_mult),
                    log_type  = "study",
                    logged_at = log_date,
                ))
            # Some assignment writing time
            if random.random() < 0.4:
                db.session.add(TimeLog(
                    user_id       = student.id,
                    assignment_id = random.choice(assignments).id,
                    description   = "Working on assignment",
                    minutes       = random.randint(20, 90),
                    log_type      = "assignment",
                    logged_at     = log_date,
                ))

    # ── Notifications ─────────────────────────────────────────────────────
    for student in students:
        db.session.add(Notification(
            user_id = student.id,
            title   = "Assignment Due Soon",
            message = "Network Protocols assignment is due in 2 days.",
            type    = "deadline",
        ))

    # Commit everything before risk calculation
    db.session.commit()

    # ── Risk Profiles — uses actual risk_engine ───────────────────────────
    # Import here to avoid circular imports at module level
    from app.services.risk_engine import recalculate_risk

    for student in students:
        try:
            recalculate_risk(student.id)
        except Exception as e:
            print(f"  Risk calc failed for {student.full_name}: {e}")

    db.session.commit()

    print("Seeding complete!")
    print("\nDemo Credentials:")
    print("  Admin:   admin@skillsync.edu   / password123")
    print("  Teacher: teacher@skillsync.edu / password123")
    for name, email, pattern, *_ in STUDENT_PROFILES:
        print(f"  Student: {email:<35} / password123  [{pattern}]")