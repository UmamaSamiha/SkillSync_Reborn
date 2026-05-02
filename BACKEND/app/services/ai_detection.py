"""
SkillSync — AI Detection Service
==================================
Heuristic AI-similarity scorer using vocabulary patterns,
sentence uniformity, and n-gram overlap with other submissions.
Now augmented with Claude API for deeper semantic analysis.
"""

import re
import os
import json
import google.generativeai as genai
from typing import Optional



# ──  ─────────────────────────────────

AI_PATTERNS = [
    r"\bin conclusion\b", r"\bfurthermore\b", r"\bmoreover\b",
    r"\bit is worth noting\b", r"\bit is important to note\b",
    r"\bin summary\b", r"\bto summarize\b", r"\bin this essay\b",
    r"\bdelve into\b", r"\bcomprehensive\b", r"\bfacilitate\b",
    r"\butilize\b", r"\bleverage\b", r"\bin the realm of\b",
    r"\bsignificant\b.*\bimplications\b", r"\bbeyond a shadow of a doubt\b",
]


def check_ai_similarity(text: str) -> float:
    """Your original heuristic scorer — unchanged."""
    if not text or len(text) < 50:
        return 0.0

    score = 0.0

    pattern_hits = sum(1 for p in AI_PATTERNS if re.search(p, text.lower()))
    score += min(pattern_hits / len(AI_PATTERNS), 1.0) * 0.4

    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if len(s.strip()) > 10]
    if len(sentences) >= 3:
        lengths  = [len(s.split()) for s in sentences]
        mean_len = sum(lengths) / len(lengths)
        variance = sum((l - mean_len) ** 2 for l in lengths) / len(lengths)
        normalized_variance = min(variance / 100, 1.0)
        uniformity_score    = 1.0 - normalized_variance
        score += uniformity_score * 0.35

    words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
    if len(words) >= 20:
        unique_words = set(words)
        ttr          = len(unique_words) / len(words)
        ai_ttr_score = 1.0 - abs(ttr - 0.6)
        score += max(ai_ttr_score, 0) * 0.25

    return round(min(score, 1.0), 3)


def compute_similarity(text1: str, text2: str) -> float:
    """Your original plagiarism scorer — unchanged."""
    def ngrams(text: str, n: int = 3):
        text = re.sub(r'\s+', ' ', text.lower().strip())
        return {text[i:i+n] for i in range(len(text) - n + 1)}

    ng1 = ngrams(text1)
    ng2 = ngrams(text2)
    if not ng1 or not ng2:
        return 0.0

    intersection = len(ng1 & ng2)
    union        = len(ng1 | ng2)
    return round(intersection / union, 3)


# ── Gemini-powered deep analysis ──────────────────────────────────────────────
def _claude_score(text: str) -> dict:
    prompt = f"""You are an AI content detection expert reviewing a student submission.

Estimate the likelihood (0–100) that this was written by an AI like ChatGPT or Gemini.

Key signals to check:
- Unnaturally uniform sentence length and structure
- Generic, textbook-style phrasing with no personal voice
- Overuse of transition phrases (furthermore, moreover, in conclusion)
- Perfect grammar with zero hesitation or natural errors
- Broad coverage with shallow depth — "essay padding" style

Return ONLY this JSON, no extra text:
{{
  "ai_score": <integer 0-100>,
  "confidence": "<low|medium|high>",
  "reason": "<one sentence>"
}}

Submission:
\"\"\"
{text[:1500]}
\"\"\""""

    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    model = genai.GenerativeModel("gemini-1.5-flash")
    raw = model.generate_content(prompt).text.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = re.sub(r"```[a-z]*\n?", "", raw).strip("` \n")
    result = json.loads(raw)
    result["ai_score"] = max(0, min(100, int(result.get("ai_score", 0))))
    return result


def analyze_submission(text: str, use_claude: bool = True) -> dict:
    """
    Main entry point for your Flask route.
    
    Combines heuristic score + Claude score into a final weighted result.
    Returns:
        {
            "ai_score": 74,              # final blended score (0-100)
            "heuristic_score": 68,       # your original scorer
            "claude_score": 80,          # Claude's estimate
            "confidence": "high",
            "reason": "...",
            "flagged": True              # True if ai_score >= 60
        }
    
    If use_claude=False (e.g. API unavailable), falls back to heuristic only.
    """
    if not text or len(text.strip()) < 50:
        return {
            "ai_score": 0,
            "heuristic_score": 0,
            "claude_score": None,
            "confidence": "low",
            "reason": "Text too short to analyze.",
            "flagged": False,
        }

    # Always run heuristic — it's free and instant
    heuristic_raw   = check_ai_similarity(text)          # 0.0–1.0
    heuristic_score = round(heuristic_raw * 100)         # convert to 0–100

    if not use_claude:
        return {
            "ai_score": heuristic_score,
            "heuristic_score": heuristic_score,
            "claude_score": None,
            "confidence": "low",
            "reason": "Heuristic analysis only (Claude unavailable).",
            "flagged": heuristic_score >= 60,
        }

    try:
        claude_result = _claude_score(text)
        claude_score  = claude_result["ai_score"]

        # Weighted blend: Claude is more reliable so gets higher weight
        blended = round(heuristic_score * 0.35 + claude_score * 0.65)

        return {
            "ai_score":        blended,
            "heuristic_score": heuristic_score,
            "claude_score":    claude_score,
            "confidence":      claude_result.get("confidence", "medium"),
            "reason":          claude_result.get("reason", ""),
            "flagged":         blended >= 60,
        }

    except (json.JSONDecodeError, KeyError, Exception) as e:
        return {
            "ai_score":        heuristic_score,
            "heuristic_score": heuristic_score,
            "claude_score":    None,
            "confidence":      "low",
            "reason":          f"AI unavailable, heuristic only. ({str(e)})",
            "flagged":         heuristic_score >= 60,
        }