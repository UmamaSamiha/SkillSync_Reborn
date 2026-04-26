def classify_student(avg_grade, attendance, late_submissions, trend):
    if avg_grade >= 80 and attendance >= 85 and trend != "falling":
        return "Consistent Performer"

    if trend == "rising" and avg_grade >= 65:
        return "Improving"

    if avg_grade < 60 or attendance < 70 or late_submissions > 5:
        return "At-Risk"

    if trend == "falling":
        return "Declining"

    return "Average"


def get_risk_level(avg_grade, attendance, late_submissions):
    if avg_grade < 50 or attendance < 60 or late_submissions > 8:
        return "high"

    if avg_grade < 70 or attendance < 75 or late_submissions > 4:
        return "medium"

    return "low"