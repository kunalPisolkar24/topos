"""Structural verification for generated posts.

The LLM is asked for an exact section shape per length but does not always
oblige (extra sections, missing sections, stray markup). These deterministic
checks catch the structural problems so the caller can ask for a repair
before returning to the UI. Cosmetic gaps are reported separately and never
trigger a repair.
"""

import re
from dataclasses import dataclass

_HEADING_RE = re.compile(r"<h2\b[^>]*>", re.IGNORECASE)
_FENCE_RE = re.compile(r"```")
_FORBIDDEN_TAGS_RE = re.compile(r"<(html|head|body|h1)[\s>]", re.IGNORECASE)

EXPECTED_SECTIONS = {
    "QUICK": (2, 2),
    "STANDARD": (3, 4),
    "DEEP_DIVE": (5, 6),
}
DEFAULT_LENGTH = "STANDARD"

MAX_POST_ATTEMPTS = 3


@dataclass(frozen=True)
class PostSpec:
    want_min: int
    want_max: int


def spec_for_length(length: str) -> PostSpec:
    """Section range for a length selector; unknown means STANDARD."""
    low, high = EXPECTED_SECTIONS.get(length or "", EXPECTED_SECTIONS[DEFAULT_LENGTH])
    return PostSpec(want_min=low, want_max=high)


def section_count(body: str) -> int:
    return len(_HEADING_RE.findall(body or ""))


def verify_post(
    title: str, body: str, summary: str, tags: list[str], spec: PostSpec
) -> list[str]:
    """Hard structural problems; any entry should trigger a repair."""
    del title, summary, tags  # shape-checked elsewhere, not structural
    issues = []
    n = section_count(body)
    if not spec.want_min <= n <= spec.want_max:
        issues.append(f"sections={n} want {spec.want_min}-{spec.want_max}")
    if _FENCE_RE.search(body or ""):
        issues.append("markdown-fence-in-body")
    if _FORBIDDEN_TAGS_RE.search(body or ""):
        issues.append("forbidden-structural-tag")
    return issues


def soft_check_post(title: str, summary: str, tags: list[str]) -> list[str]:
    """Cosmetic gaps worth logging but never worth a repair."""
    notes = []
    if not (title or "").strip():
        notes.append("empty-title")
    if not (summary or "").strip():
        notes.append("empty-summary")
    if not isinstance(tags, list) or not 5 <= len(tags) <= 7:
        notes.append(f"tags={len(tags) if isinstance(tags, list) else '?'}")
    return notes


def repair_user_prompt(
    original_user_prompt: str, spec: PostSpec, issues: list[str]
) -> str:
    """Ask for the same post again with the structural defects fixed."""
    if spec.want_min == spec.want_max:
        shape = f"exactly {spec.want_min} <h2> sections"
    else:
        shape = f"between {spec.want_min} and {spec.want_max} <h2> sections"
    problems = "".join(f"- {issue}\n" for issue in issues)
    return (
        f"{original_user_prompt}\n\n"
        f"Your previous answer had these problems:\n{problems}"
        f"Regenerate the post with {shape} (the introduction and the "
        f"conclusion are plain paragraphs, not sections). Return the FULL "
        f"post JSON again with the same keys."
    )
