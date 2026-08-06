import io
from tests.conftest import auth_headers


def test_file_resource_upload_then_download_roundtrip(client, tokens, test_course):
    """
    Regression test for the send_file() relative-path bug: Flask resolves a
    relative path passed to send_file() against app.root_path, not the
    process CWD, so a naive os.path.join(UPLOAD_FOLDER, file_path) broke
    downloads even though the file existed right where it should.
    """
    data = {
        "course_id": test_course["id"],
        "title": "Regression Test PDF",
        "file": (io.BytesIO(b"%PDF-1.4 fake pdf content"), "notes.pdf"),
    }
    res = client.post(
        "/api/resources", headers=auth_headers(tokens["teacher"]),
        data=data, content_type="multipart/form-data",
    )
    assert res.status_code == 201, res.get_json()
    resource = res.get_json()["data"]
    assert resource["file_path"]

    dl = client.get(f"/api/resources/{resource['id']}/download", headers=auth_headers(tokens["teacher"]))
    assert dl.status_code == 200
    assert dl.data.startswith(b"%PDF")
    dl.close()


def test_unenrolled_student_cannot_see_or_download_course_resources(client, tokens, test_course):
    data = {
        "course_id": test_course["id"],
        "title": "Gated Resource",
        "file": (io.BytesIO(b"%PDF-1.4 fake pdf content"), "gated.pdf"),
    }
    res = client.post(
        "/api/resources", headers=auth_headers(tokens["teacher"]),
        data=data, content_type="multipart/form-data",
    )
    resource = res.get_json()["data"]

    res = client.get(
        f"/api/resources/course/{test_course['id']}", headers=auth_headers(tokens["other_student"])
    )
    assert res.status_code == 403

    dl = client.get(
        f"/api/resources/{resource['id']}/download", headers=auth_headers(tokens["other_student"])
    )
    assert dl.status_code == 403


def test_enrolled_student_can_list_and_download_resources(client, tokens, test_course, enrolled_student):
    data = {
        "course_id": test_course["id"],
        "title": "Visible Resource",
        "file": (io.BytesIO(b"%PDF-1.4 fake pdf content"), "visible.pdf"),
    }
    res = client.post(
        "/api/resources", headers=auth_headers(tokens["teacher"]),
        data=data, content_type="multipart/form-data",
    )
    resource = res.get_json()["data"]

    res = client.get(f"/api/resources/course/{test_course['id']}", headers=auth_headers(enrolled_student))
    assert res.status_code == 200
    assert any(r["id"] == resource["id"] for r in res.get_json()["data"])

    dl = client.get(f"/api/resources/{resource['id']}/download", headers=auth_headers(enrolled_student))
    assert dl.status_code == 200
