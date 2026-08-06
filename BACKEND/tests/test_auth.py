from tests.conftest import auth_headers, STUDENT_EMAIL, SEED_PASSWORD


def test_login_succeeds_with_correct_credentials(client):
    res = client.post("/api/auth/login", json={"email": STUDENT_EMAIL, "password": SEED_PASSWORD})
    assert res.status_code == 200
    assert res.get_json()["data"]["access_token"]


def test_login_rejects_wrong_password(client):
    res = client.post("/api/auth/login", json={"email": STUDENT_EMAIL, "password": "wrong-password"})
    assert res.status_code == 401


def test_protected_route_requires_token(client):
    res = client.get("/api/courses/")
    assert res.status_code == 401


def test_protected_route_accepts_valid_token(client, tokens):
    res = client.get("/api/courses/", headers=auth_headers(tokens["student"]))
    assert res.status_code == 200
