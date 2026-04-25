from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from app import db
from app.models import QuestionBank, Question
from app.utils.helpers import success, error, get_current_user

qbank_bp = Blueprint("question_bank", __name__)

VALID_TYPES       = {"mcq", "true_false", "short_answer"}
VALID_DIFFICULTIES = {"beginner", "intermediate", "advanced"}


def _validate_question(data):
    errors = []
    qtype  = data.get("question_type", "")
    answer = data.get("correct_answer", "")
    opts   = data.get("options", [])

    if qtype not in VALID_TYPES:
        errors.append(f"question_type must be one of: {', '.join(VALID_TYPES)}")

    if qtype == "mcq":
        if not opts or len(opts) < 2:
            errors.append("MCQ requires at least 2 options")
        elif answer not in opts:
            errors.append("correct_answer must be one of the provided options")

    elif qtype == "true_false":
        if str(answer).lower() not in ("true", "false"):
            errors.append("true_false correct_answer must be 'true' or 'false'")

    elif qtype == "short_answer":
        if not str(answer).strip():
            errors.append("short_answer correct_answer must be a non-empty string")

    return errors


# ── Banks ─────────────────────────────────────────────────────────────────────

@qbank_bp.route("/banks", methods=["GET"])
@jwt_required()
def list_banks():
    banks = QuestionBank.query.order_by(QuestionBank.created_at.desc()).all()
    return success([b.to_dict() for b in banks])


@qbank_bp.route("/banks", methods=["POST"])
@jwt_required()
def create_bank():
    current = get_current_user()
    if current.role.value not in ("teacher", "admin"):
        return error("Only teachers and admins can create question banks", 403)

    data = request.get_json(silent=True) or {}
    if not data.get("title"):
        return error("title is required", 400)

    bank = QuestionBank(
        created_by  = current.id,
        title       = data["title"].strip(),
        description = data.get("description", ""),
    )
    db.session.add(bank)
    db.session.commit()
    return success(bank.to_dict(), status=201)


@qbank_bp.route("/banks/<int:bank_id>", methods=["PUT"])
@jwt_required()
def update_bank(bank_id):
    current = get_current_user()
    if current.role.value not in ("teacher", "admin"):
        return error("Forbidden", 403)

    bank = QuestionBank.query.get_or_404(bank_id)
    data = request.get_json(silent=True) or {}

    if "title"       in data: bank.title       = data["title"].strip()
    if "description" in data: bank.description = data["description"]

    db.session.commit()
    return success(bank.to_dict())


@qbank_bp.route("/banks/<int:bank_id>", methods=["DELETE"])
@jwt_required()
def delete_bank(bank_id):
    current = get_current_user()
    if current.role.value not in ("teacher", "admin"):
        return error("Forbidden", 403)

    bank = QuestionBank.query.get_or_404(bank_id)
    db.session.delete(bank)
    db.session.commit()
    return success(None, "Bank deleted")


# ── Questions ─────────────────────────────────────────────────────────────────

@qbank_bp.route("/banks/<int:bank_id>/questions", methods=["GET"])
@jwt_required()
def list_questions(bank_id):
    QuestionBank.query.get_or_404(bank_id)
    questions = Question.query.filter_by(bank_id=bank_id).order_by(Question.created_at).all()
    return success([q.to_dict() for q in questions])


@qbank_bp.route("/banks/<int:bank_id>/questions", methods=["POST"])
@jwt_required()
def add_question(bank_id):
    current = get_current_user()
    if current.role.value not in ("teacher", "admin"):
        return error("Only teachers and admins can add questions", 403)

    QuestionBank.query.get_or_404(bank_id)
    data = request.get_json(silent=True) or {}

    if not data.get("text"):
        return error("text is required", 400)
    if not data.get("question_type"):
        return error("question_type is required", 400)

    # Normalise true_false answer to lowercase string
    if data.get("question_type") == "true_false":
        data["correct_answer"] = str(data.get("correct_answer", "")).lower()

    errs = _validate_question(data)
    if errs:
        return error(" | ".join(errs), 400)

    diff = data.get("difficulty", "beginner")
    if diff not in VALID_DIFFICULTIES:
        return error(f"difficulty must be one of: {', '.join(VALID_DIFFICULTIES)}", 400)

    question = Question(
        bank_id        = bank_id,
        created_by     = current.id,
        text           = data["text"].strip(),
        question_type  = data["question_type"],
        difficulty     = diff,
        options        = data.get("options", []),
        correct_answer = str(data.get("correct_answer", "")),
        points         = int(data.get("points", 1)),
    )
    db.session.add(question)
    db.session.commit()
    return success(question.to_dict(), status=201)


@qbank_bp.route("/banks/<int:bank_id>/questions/<int:question_id>", methods=["PUT"])
@jwt_required()
def update_question(bank_id, question_id):
    current = get_current_user()
    if current.role.value not in ("teacher", "admin"):
        return error("Forbidden", 403)

    question = Question.query.get_or_404(question_id)
    data     = request.get_json(silent=True) or {}

    if "text"           in data: question.text           = data["text"].strip()
    if "difficulty"     in data: question.difficulty     = data["difficulty"]
    if "options"        in data: question.options        = data["options"]
    if "correct_answer" in data: question.correct_answer = str(data["correct_answer"])
    if "points"         in data: question.points         = int(data["points"])

    db.session.commit()
    return success(question.to_dict())


@qbank_bp.route("/banks/<int:bank_id>/questions/<int:question_id>", methods=["DELETE"])
@jwt_required()
def delete_question(bank_id, question_id):
    current = get_current_user()
    if current.role.value not in ("teacher", "admin"):
        return error("Forbidden", 403)

    question = Question.query.get_or_404(question_id)
    db.session.delete(question)
    db.session.commit()
    return success(None, "Question deleted")