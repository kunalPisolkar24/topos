from src.domain.prompts import post_user_prompt, styled_post_user_prompt


def test_legacy_prompt_unchanged() -> None:
    prompt = post_user_prompt("kafka")
    assert "kafka" in prompt
    assert "3-4 detailed subsections" in prompt
    assert "professional yet accessible" in prompt


def test_styled_prompt_carries_brief_guidance() -> None:
    prompt = styled_post_user_prompt(
        "postgres indexing",
        audience="PRACTITIONER",
        tone="WITTY",
        length="QUICK",
        structure="COMPARISON",
        keywords="postgres, indexing",
        key_points="Covering indexes\nPartial indexes",
    )
    assert "postgres indexing" in prompt
    assert "working practitioners" in prompt
    assert "dry wit" in prompt
    assert "2 short subsections" in prompt
    assert "comparison" in prompt
    assert "Covering indexes" in prompt
    assert "postgres, indexing" in prompt


def test_styled_prompt_falls_back_on_empty_selectors() -> None:
    prompt = styled_post_user_prompt("kafka")
    assert "3-4 detailed subsections" in prompt
    assert "professional yet accessible" in prompt
    assert "Audience" not in prompt


def test_styled_prompt_ignores_unknown_selectors() -> None:
    prompt = styled_post_user_prompt("kafka", tone="NOPE", length="NOPE")
    assert "professional yet accessible" in prompt
    assert "3-4 detailed subsections" in prompt
