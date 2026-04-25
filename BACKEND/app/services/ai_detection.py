"""
SkillSync — AI Detection Service
==================================
Heuristic AI-similarity scorer using vocabulary patterns,
sentence uniformity, and n-gram overlap with other submissions.
Not a replacement for dedicated tools — flags for human review.
"""

import re
import math
from typing import Optional


# Common AI writing patterns / phrases
AI_PATTERNS = [
    r"\bin conclusion\b", r"\bfurthermore\b", r"\bmoreover\b",
    r"\bit is worth noting\b", r"\bit is important to note\b",
    r"\bin summary\b", r"\bto summarize\b", r"\bin this essay\b",
    r"\bdelve into\b", r"\bcomprehensive\b", r"\bfacilitate\b",
    r"\butilize\b", r"\bleverage\b", r"\bin the realm of\b",
    r"\bsignificant\b.*\bimplications\b", r"\bbeyond a shadow of a doubt\b",
]


def check_ai_similarity(text: str) -> float:
    """
    Returns a 0.0–1.0 score indicating AI-generated probability.
    Higher = more likely AI-generated. Threshold configured in app config.
    
    Uses three heuristics:
    1. AI phrase pattern matching
    2. Sentence length variance (AI tends to be uniform)
    3. Vocabulary richness (type-token ratio)
    """
    if not text or len(text) < 50:
        return 0.0

    score = 0.0

    # ── Heuristic 1: Pattern matching ──────────────────────────────────────
    pattern_hits = sum(
        1 for p in AI_PATTERNS if re.search(p, text.lower())
    )
    score += min(pattern_hits / len(AI_PATTERNS), 1.0) * 0.4

    # ── Heuristic 2: Sentence length variance ──────────────────────────────
    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if len(s.strip()) > 10]
    if len(sentences) >= 3:
        lengths  = [len(s.split()) for s in sentences]
        mean_len = sum(lengths) / len(lengths)
        variance = sum((l - mean_len) ** 2 for l in lengths) / len(lengths)
        # Low variance = uniform = more AI-like
        normalized_variance = min(variance / 100, 1.0)
        uniformity_score    = 1.0 - normalized_variance
        score += uniformity_score * 0.35

    # ── Heuristic 3: Type-Token Ratio (vocabulary richness) ────────────────
    words      = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
    if len(words) >= 20:
        unique_words = set(words)
        ttr          = len(unique_words) / len(words)
        # AI text tends to have moderately high TTR but very consistent style
        # Low TTR can also indicate repetitive AI output
        ai_ttr_score = 1.0 - abs(ttr - 0.6)   # 0.6 is "suspiciously uniform"
        score += max(ai_ttr_score, 0) * 0.25

    return round(min(score, 1.0), 3)


def compute_similarity(text1: str, text2: str) -> float:
    """
    Compute cosine similarity between two texts using character n-grams.
    Used for plagiarism detection between submissions.
    Returns 0.0–1.0.
    """
    def ngrams(text: str, n: int = 3):
        text = re.sub(r'\s+', ' ', text.lower().strip())
        return {text[i:i+n] for i in range(len(text) - n + 1)}

    ng1 = ngrams(text1)
    ng2 = ngrams(text2)

    if not ng1 or not ng2:
        return 0.0

    intersection = len(ng1 & ng2)
    union        = len(ng1 | ng2)
    return round(intersection / union, 3)  # Jaccard similarity