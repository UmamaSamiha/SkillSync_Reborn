from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from app import db
from app.models import AnushkaQuestionBank, AnushkaQuestion
from app.utils.helpers import success, error, get_current_user

qbank_bp = Blueprint("anushka_qbank", __name__)


@qbank_bp.route("", methods=["GET"], strict_slashes=False)
@jwt_required()
def list_banks():
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    banks = AnushkaQuestionBank.query.all()
    return success([b.to_dict() for b in banks])


@qbank_bp.route("", methods=["POST"], strict_slashes=False)
@jwt_required()
def create_bank():
    user = get_current_user()
    if not user or str(user.role) not in ("admin", "teacher"):
        return error("Admin or Teacher access required", 403)
    data = request.get_json(silent=True) or {}
    title = data.get("title", "").strip()
    if not title:
        return error("title is required", 400)
    bank = AnushkaQuestionBank(
        title       = title,
        description = data.get("description", ""),
        track       = data.get("track", ""),
        created_by  = user.id,
    )
    db.session.add(bank)
    db.session.commit()
    return success(bank.to_dict(), "Question bank created", 201)


@qbank_bp.route("/<int:bank_id>", methods=["GET"], strict_slashes=False)
@jwt_required()
def get_bank(bank_id):
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    bank = AnushkaQuestionBank.query.get(bank_id)
    if not bank:
        return error("Question bank not found", 404)
    questions = [q.to_dict() for q in bank.questions]
    return success({**bank.to_dict(), "questions": questions})


@qbank_bp.route("/<int:bank_id>", methods=["DELETE"], strict_slashes=False)
@jwt_required()
def delete_bank(bank_id):
    user = get_current_user()
    if not user or str(user.role) not in ("admin", "teacher"):
        return error("Admin or Teacher access required", 403)
    bank = AnushkaQuestionBank.query.get(bank_id)
    if not bank:
        return error("Question bank not found", 404)
    db.session.delete(bank)
    db.session.commit()
    return success(None, "Question bank deleted")


@qbank_bp.route("/<int:bank_id>/questions", methods=["GET"], strict_slashes=False)
@jwt_required()
def get_questions(bank_id):
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    bank = AnushkaQuestionBank.query.get(bank_id)
    if not bank:
        return error("Question bank not found", 404)
    questions = [q.to_dict() for q in bank.questions]
    return success(questions)


@qbank_bp.route("/<int:bank_id>/questions", methods=["POST"], strict_slashes=False)
@jwt_required()
def add_question(bank_id):
    user = get_current_user()
    if not user or str(user.role) not in ("admin", "teacher"):
        return error("Admin or Teacher access required", 403)
    bank = AnushkaQuestionBank.query.get(bank_id)
    if not bank:
        return error("Question bank not found", 404)
    data = request.get_json(silent=True) or {}
    text = data.get("text", "").strip()
    if not text:
        return error("text is required", 400)
    question = AnushkaQuestion(
        bank_id     = bank_id,
        text        = text,
        q_type      = data.get("question_type", data.get("q_type", "mcq")),
        difficulty  = data.get("difficulty", "beginner"),
        options     = data.get("options", []),
        correct     = data.get("correct_answer", data.get("correct", "")),
        explanation = data.get("explanation", ""),
    )
    db.session.add(question)
    db.session.commit()
    return success(question.to_dict(), "Question added", 201)


@qbank_bp.route("/<int:bank_id>/questions/<int:question_id>", methods=["DELETE"], strict_slashes=False)
@jwt_required()
def delete_question(bank_id, question_id):
    user = get_current_user()
    if not user or str(user.role) not in ("admin", "teacher"):
        return error("Admin or Teacher access required", 403)
    question = AnushkaQuestion.query.filter_by(id=question_id, bank_id=bank_id).first()
    if not question:
        return error("Question not found", 404)
    db.session.delete(question)
    db.session.commit()
    return success(None, "Question deleted")