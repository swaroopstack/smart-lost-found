"""
Free-text similarity.

Two complementary measures are blended:

* ``token_set_ratio`` - word-level overlap, ignores word order and duplicates.
  Good for "black scientific calculator" vs "scientific black calculator".
* ``ratio`` (Indel distance) - character-level, tolerates typos such as
  "calclator" vs "calculator".

rapidfuzz is used because it is a single compiled dependency that works the
same on SQLite and PostgreSQL, so no database extension is required.
"""

import re

from rapidfuzz import fuzz

_PUNCT = re.compile(r"[^\w\s]")
_WHITESPACE = re.compile(r"\s+")

_STOPWORDS = frozenset(
    {
        "the", "a", "an", "my", "our", "is", "are", "was", "were", "it", "its",
        "of", "and", "or", "with", "in", "on", "at", "to", "for", "from", "by",
    }
)


def normalize(text: str | None) -> str:
    """Lowercase, strip punctuation, collapse whitespace and drop stopwords."""
    if not text:
        return ""
    cleaned = _PUNCT.sub(" ", text.lower())
    tokens = [t for t in _WHITESPACE.split(cleaned) if t and t not in _STOPWORDS]
    return " ".join(tokens)


def text_similarity(a: str | None, b: str | None) -> float | None:
    """Return a 0.0-1.0 similarity, or ``None`` when there is nothing to compare."""
    na, nb = normalize(a), normalize(b)
    if not na or not nb:
        return None
    if na == nb:
        return 1.0
    token_score = fuzz.token_set_ratio(na, nb) / 100.0
    char_score = fuzz.ratio(na, nb) / 100.0
    return round(0.5 * token_score + 0.5 * char_score, 4)


def token_overlap(a: str | None, b: str | None) -> float:
    """Jaccard-style token overlap used for the hidden-detail comparison."""
    ta = set(normalize(a).split())
    tb = set(normalize(b).split())
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def hidden_detail_similarity(a: str | None, b: str | None) -> float:
    """Similarity for the secret verification detail.

    Combines token overlap with fuzzy similarity so that "red dragon sticker"
    still matches "a red dragon sticker on the back".
    """
    if not a or not b:
        return 0.0
    return max(token_overlap(a, b), text_similarity(a, b) or 0.0)
