from tests.conftest import auth_headers


def _submit(client, token, topic_id, text="my submitted work"):
    res = client.post("/api/edit-tracking/track", headers=auth_headers(token), json={
        "text": text, "title": "Test Submission", "topic_id": topic_id,
    })
    assert res.status_code == 200, res.get_json()
    return res.get_json()["data"]["submission_id"]


def _grade(client, teacher_token, submission_id, score, feedback=""):
    res = client.post(
        f"/api/edit-tracking/submission/{submission_id}/score",
        headers=auth_headers(teacher_token),
        json={"score": score, "feedback": feedback},
    )
    return res


def test_roadmap_gates_student_view_to_enrolled_courses(client, tokens, test_course):
    res = client.get("/api/curriculum/topics", headers=auth_headers(tokens["other_student"]),
                      query_string={"course_id": test_course["id"]})
    assert res.status_code == 403


def test_full_roadmap_flow_unlocks_next_step_and_issues_certificate(
    app, client, tokens, user_ids, test_course, enrolled_student
):
    course_id = test_course["id"]

    # Teacher builds a two-step roadmap: one regular step + a final exam.
    res = client.post("/api/curriculum/topics", headers=auth_headers(tokens["teacher"]), json={
        "title": "Step 1", "course_id": course_id, "order": 1, "mastery_threshold": 70,
    })
    assert res.status_code == 201
    step1 = res.get_json()["data"]

    res = client.post("/api/curriculum/topics", headers=auth_headers(tokens["teacher"]), json={
        "title": "Final Exam", "course_id": course_id, "order": 99,
        "mastery_threshold": 70, "is_final_exam": True,
    })
    assert res.status_code == 201
    exam = res.get_json()["data"]

    # Student sees step1 unlocked, exam locked (no other steps mastered yet).
    res = client.get("/api/curriculum/topics", headers=auth_headers(enrolled_student),
                      query_string={"course_id": course_id})
    by_id = {t["id"]: t for t in res.get_json()["data"]}
    assert by_id[step1["id"]]["user_status"] == "unlocked"
    assert by_id[exam["id"]]["user_status"] == "locked"

    # Student submits step1, teacher grades it below threshold -> stays locked/in_progress.
    sub1 = _submit(client, enrolled_student, step1["id"])
    res = _grade(client, tokens["teacher"], sub1, score=50, feedback="Not quite there yet")
    assert res.status_code == 200
    assert res.get_json()["data"]["unlocked"] is False

    # Grade again with a passing score -> unlocks the exam.
    res = _grade(client, tokens["teacher"], sub1, score=85, feedback="Great work!")
    assert res.status_code == 200
    assert res.get_json()["data"]["unlocked"] is True

    res = client.get("/api/curriculum/topics", headers=auth_headers(enrolled_student),
                      query_string={"course_id": course_id})
    by_id = {t["id"]: t for t in res.get_json()["data"]}
    assert by_id[step1["id"]]["user_status"] == "mastered"
    assert by_id[exam["id"]]["user_status"] == "unlocked"

    # A notification with the teacher's feedback should have reached the student.
    res = client.get("/api/notifications/", headers=auth_headers(enrolled_student),
                      query_string={"per_page": "5"})
    messages = [n["message"] for n in res.get_json()["data"]["items"]]
    assert any("Great work!" in m for m in messages)

    # No certificate yet -- only the regular step is done, not the exam.
    res = client.get(f"/api/certificates/user/{user_ids['student']}", headers=auth_headers(enrolled_student))
    course_certs = [c for c in res.get_json()["data"] if c.get("course_id") == course_id]
    assert course_certs == []

    # Student passes the final exam -> certificate is auto-issued.
    sub2 = _submit(client, enrolled_student, exam["id"], text="my exam answers")
    res = _grade(client, tokens["teacher"], sub2, score=92, feedback="Excellent.")
    assert res.status_code == 200
    body = res.get_json()["data"]
    assert body["unlocked"] is True
    assert body["cert_earned"] is True

    res = client.get(f"/api/certificates/user/{user_ids['student']}", headers=auth_headers(enrolled_student))
    course_certs = [c for c in res.get_json()["data"] if c.get("course_id") == course_id]
    assert len(course_certs) == 1
    cert = course_certs[0]
    assert cert["course_title"] == test_course["title"]

    # The certificate PDF must actually download (send_file path-resolution regression).
    dl = client.get(f"/api/certificates/{cert['id']}/download", headers=auth_headers(enrolled_student))
    assert dl.status_code == 200
    assert dl.data.startswith(b"%PDF")
    dl.close()

    # Grading the exam a second time must not issue a duplicate certificate.
    res = _grade(client, tokens["teacher"], sub2, score=95, feedback="")
    assert res.get_json()["data"]["cert_earned"] is False
    res = client.get(f"/api/certificates/user/{user_ids['student']}", headers=auth_headers(enrolled_student))
    course_certs = [c for c in res.get_json()["data"] if c.get("course_id") == course_id]
    assert len(course_certs) == 1
