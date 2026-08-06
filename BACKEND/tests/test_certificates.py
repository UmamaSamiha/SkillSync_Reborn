from tests.conftest import auth_headers


def test_student_can_self_generate_and_download_a_certificate(app, client, tokens, user_ids):
    res = client.post("/api/certificates/generate", headers=auth_headers(tokens["student"]), json={
        "user_id": user_ids["student"], "title": "Regression Test Certificate",
    })
    assert res.status_code == 201, res.get_json()
    cert = res.get_json()["data"]
    assert cert["verification_code"]

    dl = client.get(f"/api/certificates/{cert['id']}/download", headers=auth_headers(tokens["student"]))
    assert dl.status_code == 200
    assert dl.data.startswith(b"%PDF")
    dl.close()  # release the file handle send_file() opened, or Windows can't delete it below

    res = client.get(f"/api/certificates/verify/{cert['verification_code']}")
    assert res.status_code == 200
    assert res.get_json()["data"]["valid"] is True

    # cleanup
    with app.app_context():
        import os
        from app import db
        from app.models import Certificate
        c = Certificate.query.get(cert["id"])
        if c.file_path and os.path.exists(os.path.abspath(c.file_path)):
            os.remove(os.path.abspath(c.file_path))
        db.session.delete(c)
        db.session.commit()


def test_student_cannot_generate_certificate_for_someone_else(client, tokens, user_ids):
    res = client.post("/api/certificates/generate", headers=auth_headers(tokens["student"]), json={
        "user_id": user_ids["other_student"],
    })
    assert res.status_code == 403
