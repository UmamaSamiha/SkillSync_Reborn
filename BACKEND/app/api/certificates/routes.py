"""
SkillSync — Certificates API
==============================
Generate, download, and verify certificates.
Students can generate and download their own certificates.
Teachers/admins can generate for any student.
"""
import uuid
import os
from datetime import datetime, timezone
from flask import Blueprint, request, current_app, send_file
from flask_jwt_extended import jwt_required
from app import db
from app.models import Certificate, User, FocusSession, GradeRecord
from app.utils.helpers import success, error, get_current_user, teacher_or_admin
from sqlalchemy import func

certificates_bp = Blueprint("certificates", __name__)


# ── POST /api/certificates/generate ──────────────────────────────────────────
@certificates_bp.route("/generate", methods=["POST"])
@jwt_required()
def generate_certificate():
    """
    Generate a certificate.
    - Student: can only generate for themselves
    - Teacher/Admin: can generate for any student
    Body: { user_id, project_id?, title?, grade? }
    """
    current = get_current_user()
    if not current:
        return error("Unauthorized", 401)

    data    = request.get_json(silent=True) or {}
    user_id = data.get("user_id")

    if not user_id:
        return error("user_id is required", 400)

    # Students can only generate their own certificate
    if current.role == "student" and str(current.id) != str(user_id):
        return error("You can only generate your own certificate", 403)

    user = User.query.get(str(user_id))
    if not user:
        return error("Student not found", 404)

    # Calculate study hours from focus sessions
    total_minutes = db.session.query(
        func.sum(FocusSession.duration_minutes)
    ).filter_by(user_id=user_id).scalar() or 0

    # Auto-calculate grade from GradeRecords if not provided
    grade = data.get("grade")
    if not grade:
        records = GradeRecord.query.filter_by(user_id=user_id).all()
        if records:
            avg   = sum(r.percentage for r in records) / len(records)
            grade = _letter_grade(avg)

    verify_code = f"SS-{uuid.uuid4().hex[:10].upper()}"

    cert = Certificate(
        user_id           = user_id,
        project_id        = data.get("project_id"),
        title             = data.get("title") or f"Certificate of Completion — {user.full_name}",
        grade             = grade,
        study_hours       = round(total_minutes / 60, 1),
        verification_code = verify_code,
    )
    db.session.add(cert)
    db.session.flush()

    # Generate PDF (reportlab — optional, won't block if it fails)
    try:
        pdf_path       = _generate_pdf(cert, user)
        cert.file_path = pdf_path
    except Exception as e:
        current_app.logger.warning(f"PDF generation failed: {e}")

    db.session.commit()

    return success({
        **cert.to_dict(),
        "holder": user.to_dict(),
    }, "Certificate generated", 201)


# ── GET /api/certificates/user/<user_id> ─────────────────────────────────────
@certificates_bp.route("/user/<user_id>", methods=["GET"])
@jwt_required()
def user_certificates(user_id):
    current = get_current_user()
    if not current:
        return error("Unauthorized", 401)

    # Students can only view their own certificates
    if current.role == "student" and str(current.id) != str(user_id):
        return error("Forbidden", 403)

    certs = Certificate.query.filter_by(user_id=user_id).order_by(Certificate.issued_at.desc()).all()

    return success([{
        **c.to_dict(),
        "holder":       c.user.to_dict(),
        "download_url": f"/api/certificates/{c.id}/download",
    } for c in certs])


# ── GET /api/certificates/verify/<code> ──────────────────────────────────────
@certificates_bp.route("/verify/<code>", methods=["GET"])
def verify_certificate(code):
    """Public endpoint — no auth required."""
    cert = Certificate.query.filter_by(verification_code=code.upper()).first()

    if not cert:
        return error("Certificate not found or invalid code", 404)

    return success({
        **cert.to_dict(),
        "holder": cert.user.to_dict(),
        "valid":  cert.is_valid,
        "issuer": current_app.config.get("CERT_ISSUER", "SkillSync"),
    }, "Certificate verified")


# ── GET /api/certificates/<id>/download ──────────────────────────────────────
@certificates_bp.route("/<cert_id>/download", methods=["GET"])
@jwt_required()
def download_certificate(cert_id):
    current = get_current_user()
    cert    = Certificate.query.get_or_404(str(cert_id))

    if str(current.id) != str(cert.user_id) and current.role not in ["admin", "teacher"]:
        return error("Forbidden", 403)

    if not cert.file_path or not os.path.exists(cert.file_path):
        return error("Certificate file not available. Try regenerating.", 404)

    return send_file(
        cert.file_path,
        as_attachment=True,
        download_name=f"certificate_{cert.verification_code}.pdf",
    )


# ── DELETE /api/certificates/<id> ────────────────────────────────────────────
@certificates_bp.route("/<cert_id>", methods=["DELETE"])
@jwt_required()
@teacher_or_admin
def revoke_certificate(cert_id):
    cert          = Certificate.query.get_or_404(str(cert_id))
    cert.is_valid = False
    db.session.commit()
    return success(None, "Certificate revoked")


# ── HELPERS ───────────────────────────────────────────────────────────────────

def _letter_grade(avg: float) -> str:
    if avg >= 90: return "A+"
    if avg >= 85: return "A"
    if avg >= 80: return "A-"
    if avg >= 75: return "B+"
    if avg >= 70: return "B"
    if avg >= 65: return "B-"
    if avg >= 60: return "C+"
    if avg >= 55: return "C"
    return "F"


def _generate_pdf(cert, user) -> str:
    """Generate a styled PDF certificate using reportlab."""
    from reportlab.lib.pagesizes import landscape, A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch

    upload_dir = os.path.join(current_app.config["UPLOAD_FOLDER"], "certificates")
    os.makedirs(upload_dir, exist_ok=True)
    filepath = os.path.join(upload_dir, f"{cert.id}.pdf")

    doc    = SimpleDocTemplate(
        filepath, pagesize=landscape(A4),
        leftMargin=1*inch, rightMargin=1*inch,
        topMargin=0.5*inch, bottomMargin=0.5*inch,
    )
    styles    = getSampleStyleSheet()
    story     = []
    brand_red = colors.HexColor("#893941")
    soft_brown= colors.HexColor("#7A7063")

    title_style = ParagraphStyle(
        "cert_title", fontSize=32, alignment=1, spaceAfter=6,
        textColor=brand_red, fontName="Helvetica-Bold",
    )
    sub_style = ParagraphStyle(
        "cert_sub", fontSize=16, alignment=1, spaceAfter=20,
        textColor=soft_brown,
    )
    body_style = ParagraphStyle(
        "cert_body", fontSize=13, alignment=1, spaceAfter=8,
        textColor=colors.HexColor("#2D2D2D"),
    )
    name_style = ParagraphStyle(
        "cert_name", fontSize=26, alignment=1, spaceAfter=10,
        textColor=brand_red, fontName="Helvetica-Bold",
    )
    code_style = ParagraphStyle(
        "cert_code", fontSize=9, alignment=1, spaceAfter=4,
        textColor=soft_brown,
    )

    story.append(Spacer(1, 0.3 * inch))
    story.append(Paragraph("SkillSync", title_style))
    story.append(Paragraph("Certificate of Achievement", sub_style))
    story.append(HRFlowable(width="80%", thickness=1, color=brand_red, spaceAfter=20))
    story.append(Paragraph("This certifies that", body_style))
    story.append(Paragraph(f"<b>{user.full_name}</b>", name_style))
    story.append(Paragraph("has successfully completed", body_style))
    story.append(Paragraph(f"<i>{cert.title}</i>", body_style))
    story.append(Spacer(1, 0.2 * inch))

    if cert.grade:
        story.append(Paragraph(f"Final Grade: <b>{cert.grade}</b>", body_style))

    story.append(Paragraph(f"Total Study Hours: <b>{cert.study_hours}h</b>", body_style))
    story.append(Paragraph(f"Issued on: {cert.issued_at.strftime('%B %d, %Y')}", body_style))
    story.append(Spacer(1, 0.2 * inch))
    story.append(HRFlowable(width="60%", thickness=0.5, color=soft_brown, spaceAfter=10))
    story.append(Paragraph(f"Verification Code: <b>{cert.verification_code}</b>", code_style))

    base_url = current_app.config.get("CERT_VERIFICATION_BASE_URL", "https://skillsync.edu/verify")
    story.append(Paragraph(f"Verify at: {base_url}/{cert.verification_code}", code_style))

    doc.build(story)
    return filepath