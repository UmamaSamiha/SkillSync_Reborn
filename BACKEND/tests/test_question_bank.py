from tests.conftest import auth_headers


def _create_bank(client, tokens, course_id):
    res = client.post("/api/question-bank", headers=auth_headers(tokens["teacher"]), json={
        "title": "Regression Test Bank", "course_id": course_id,
    })
    assert res.status_code == 201, res.get_json()
    return res.get_json()["data"]


def test_unenrolled_student_cannot_see_course_scoped_bank(app, client, tokens, test_course):
    bank = _create_bank(client, tokens, test_course["id"])

    res = client.get("/api/question-bank", headers=auth_headers(tokens["other_student"]))
    assert res.status_code == 200
    bank_ids = [b["id"] for b in res.get_json()["data"]]
    assert bank["id"] not in bank_ids

    res = client.get(f"/api/question-bank/{bank['id']}", headers=auth_headers(tokens["other_student"]))
    assert res.status_code == 403


def test_enrolled_student_can_see_course_scoped_bank(app, client, tokens, test_course, enrolled_student):
    bank = _create_bank(client, tokens, test_course["id"])

    res = client.get("/api/question-bank", headers=auth_headers(enrolled_student))
    assert res.status_code == 200
    bank_ids = [b["id"] for b in res.get_json()["data"]]
    assert bank["id"] in bank_ids

    res = client.get(f"/api/question-bank/{bank['id']}", headers=auth_headers(enrolled_student))
    assert res.status_code == 200


def test_admin_can_add_bank_to_any_course(client, tokens, test_course):
    res = client.post("/api/question-bank", headers=auth_headers(tokens["admin"]), json={
        "title": "Admin-created bank", "course_id": test_course["id"],
    })
    assert res.status_code == 201
