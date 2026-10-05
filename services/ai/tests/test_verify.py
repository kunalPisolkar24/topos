from src.domain.verify import (
    MAX_POST_ATTEMPTS,
    repair_user_prompt,
    section_count,
    soft_check_post,
    spec_for_length,
    verify_post,
)


def good_body(n: int) -> str:
    parts = ["<p>intro</p>"]
    for i in range(n):
        parts.append(f"<h2>Section {i}</h2><p>text</p>")
    parts.append("<p>conclusion</p>")
    return "".join(parts)


def test_spec_for_length_ranges() -> None:
    assert spec_for_length("QUICK").want_min == 2
    assert spec_for_length("QUICK").want_max == 2
    assert spec_for_length("STANDARD").want_min == 3
    assert spec_for_length("STANDARD").want_max == 4
    assert spec_for_length("DEEP_DIVE").want_min == 5
    assert spec_for_length("DEEP_DIVE").want_max == 6
    assert spec_for_length("") == spec_for_length("STANDARD")
    assert spec_for_length("NOPE") == spec_for_length("STANDARD")


def test_section_count_case_insensitive() -> None:
    assert section_count("<H2>A</H2><h2 class='x'>B</h2>") == 2
    assert section_count("<p>no sections</p>") == 0


def test_verify_post_accepts_good_shapes() -> None:
    assert (
        verify_post(
            "t", good_body(2), "s", ["a", "b", "c", "d", "e"], spec_for_length("QUICK")
        )
        == []
    )
    assert verify_post("t", good_body(3), "s", ["a"], spec_for_length("STANDARD")) == []
    assert (
        verify_post("t", good_body(6), "s", ["a"], spec_for_length("DEEP_DIVE")) == []
    )


def test_verify_post_flags_section_count() -> None:
    issues = verify_post("t", good_body(5), "s", ["a"], spec_for_length("QUICK"))
    assert issues == ["sections=5 want 2-2"]
    issues = verify_post("t", good_body(0), "s", ["a"], spec_for_length("STANDARD"))
    assert issues == ["sections=0 want 3-4"]


def test_verify_post_flags_markup() -> None:
    body = good_body(3).replace("</p>", "</p>", 1) + "```json"
    assert "markdown-fence-in-body" in verify_post(
        "t", body, "s", [], spec_for_length("STANDARD")
    )
    assert "forbidden-structural-tag" in verify_post(
        "t", "<h1>Title</h1>" + good_body(3), "s", [], spec_for_length("STANDARD")
    )


def test_soft_check_never_blocks() -> None:
    assert soft_check_post("", "", []) == ["empty-title", "empty-summary", "tags=0"]
    assert soft_check_post("t", "s", ["a", "b", "c", "d", "e", "f", "g", "h"]) == [
        "tags=8"
    ]
    assert soft_check_post("t", "s", ["a"]) == ["tags=1"]


def test_repair_prompt_names_shape_and_issues() -> None:
    prompt = repair_user_prompt(
        "original brief", spec_for_length("QUICK"), ["sections=5 want 2-2"]
    )
    assert "original brief" in prompt
    assert "exactly 2 <h2> sections" in prompt
    assert "sections=5 want 2-2" in prompt
    assert "FULL post JSON" in prompt


def test_max_post_attempts_is_bounded() -> None:
    assert MAX_POST_ATTEMPTS == 3
