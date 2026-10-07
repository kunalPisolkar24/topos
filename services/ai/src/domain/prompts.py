SUMMARY_PROMPT = (
    "You are a concise editor. Summarize the provided text in exactly 3 clear "
    "sentences. Focus on the main idea and key takeaways."
)

TAGS_PROMPT = (
    "You are an SEO specialist. Analyze the content and extract 5-7 highly "
    "relevant keywords or tags. Return ONLY a raw JSON array of strings, e.g. "
    '["technology", "innovation"]. No explanation, no markdown.'
)

POST_PROMPT = (
    "You are an expert content writer. Write a structured, professional blog "
    "post for a rich-text editor.\n"
    "STRICT OUTPUT RULES:\n"
    "1. Return ONLY a valid JSON object, no markdown.\n"
    "2. The JSON must contain exactly these keys: 'title', 'body', 'summary', 'tags'.\n"
    "3. 'body' must be raw HTML: <h2> for section headers, <p> for paragraphs, "
    "<ul>/<li> for lists, <strong> for emphasis. No markdown, no "
    "<html>/<head>/<body> tags.\n"
    "4. 'tags' is an array of 5-7 strings.\n"
    "5. Escape double quotes inside HTML content so the JSON stays valid."
)


def post_user_prompt(topic: str) -> str:
    return (
        f"Write a comprehensive blog post about: '{topic}'.\n"
        "Structure:\n"
        "- Catchy, SEO-optimized title.\n"
        "- Engaging introduction.\n"
        "- 3-4 detailed subsections (use <h2>).\n"
        "- Conclusion.\n"
        "Keep the tone professional yet accessible."
    )


AUDIENCE_GUIDANCE = {
    "BEGINNER": "written for beginners: explain jargon on first use, prefer concrete examples over abstractions.",
    "PRACTITIONER": "written for working practitioners: dense and practical, skip the basics.",
    "EXPERT": "written for experts: assume deep background, focus on trade-offs and edge cases.",
}

TONE_GUIDANCE = {
    "PROFESSIONAL": "professional yet accessible.",
    "CONVERSATIONAL": "conversational and direct, second person where natural.",
    "TECHNICAL": "precise and technical, exact terminology, no dumbing down.",
    "STORYTELLING": "narrative voice with concrete scenes and characters.",
    "WITTY": "dry wit, sharp sentences, no fluff.",
    "MINIMAL": "terse voice, short sentences, no filler.",
}

LENGTH_GUIDANCE = {
    "QUICK": "a compact post: engaging introduction, 2 short subsections (use <h2>), conclusion.",
    "STANDARD": "3-4 detailed subsections (use <h2>) between introduction and conclusion.",
    "DEEP_DIVE": "5-6 thorough subsections (use <h2>) with examples between introduction and conclusion.",
}

STRUCTURE_GUIDANCE = {
    "HOW_TO": "a how-to: setup, step-by-step walkthrough, common pitfalls.",
    "LISTICLE": "a listicle: why it matters, the key ideas, putting it together.",
    "TUTORIAL": "a tutorial: prerequisites, build it end to end, verify and debug.",
    "COMPARISON": "a comparison: each option in practice, then a verdict on which to pick.",
    "OPINION": "an opinion piece: the argument, the counterpoints, where this lands.",
    "CASE_STUDY": "a case study: starting point, what changed, results and takeaways.",
}


def styled_post_user_prompt(
    topic: str,
    audience: str = "",
    tone: str = "",
    length: str = "",
    structure: str = "",
    keywords: str = "",
    key_points: str = "",
) -> str:
    """Build the user prompt for a brief-driven post.

    Empty/unknown selectors fall back to the legacy defaults so a
    partially-filled brief still reads naturally.
    """
    lines = [f"Write a comprehensive blog post about: '{topic}'."]
    if audience in AUDIENCE_GUIDANCE:
        lines.append(f"Audience: {AUDIENCE_GUIDANCE[audience]}")
    lines.append("Structure:")
    lines.append("- Catchy, SEO-optimized title.")
    lines.append("- Engaging introduction.")
    if structure in STRUCTURE_GUIDANCE:
        lines.append(f"- {STRUCTURE_GUIDANCE[structure]}")
    lines.append(f"- {LENGTH_GUIDANCE.get(length, LENGTH_GUIDANCE['STANDARD'])}")
    lines.append("- Conclusion.")
    if key_points.strip():
        lines.append(
            f"Cover these key points across the middle sections:\n{key_points.strip()}"
        )
    if keywords.strip():
        lines.append(f"Weave in these keywords naturally: {keywords.strip()}.")
    lines.append(
        f"Keep the tone {TONE_GUIDANCE.get(tone, TONE_GUIDANCE['PROFESSIONAL'])}"
    )
    return "\n".join(lines)


CHAT_SYSTEM_PROMPT = (
    "You are the Topos blog assistant. Answer the user's question using ONLY "
    "the provided blog post excerpts, and cite the source of each claim with "
    "its bracketed number, e.g. [1]. Never invent facts that are not in the "
    "excerpts. If the excerpts do not answer the question, say that you could "
    "not find any relevant posts. Keep the answer concise and helpful."
)

REWRITE_QUERY_PROMPT = (
    "You are a search query rewriter. Rewrite the user's question into a "
    "short, self-contained search query: fix typos and spelling, expand "
    "vague wording into specific terms, and resolve pronouns or references "
    "using the conversation so far. Return ONLY the rewritten query text "
    "with no explanation, no quotes, and no punctuation at the end."
)

HISTORY_SUMMARY_PROMPT = (
    "You are a conversation summarizer. Condense the provided chat turns "
    "into a short paragraph that preserves every fact, decision, name, "
    "preference, and blog post reference the participants established. "
    "Write it as context for continuing the conversation. Return ONLY the "
    "summary text with no preamble."
)


def history_summary_user_prompt(
    prior_summary: str, turns: list[tuple[str, str]]
) -> str:
    """Assemble the compaction prompt from older turns and any summary
    produced by earlier compactions."""
    parts: list[str] = []
    if prior_summary:
        parts.append(f"Summary so far:\n{prior_summary}")
    transcript = "\n".join(f"{role.capitalize()}: {content}" for role, content in turns)
    parts.append(f"Turns to condense:\n{transcript}")
    return "\n\n".join(parts)


JUDGE_RELEVANCE_PROMPT = (
    "You are a retrieval relevance judge. Given a user's question and "
    "numbered blog post excerpts, decide whether the excerpts contain "
    "information that helps answer the question. Return ONLY a raw JSON "
    'object: {"relevant": true or false, "score": a 0.0-1.0 relevance '
    "score}. No explanation, no markdown."
)


def judge_user_prompt(query: str, contexts: list[tuple[str, str]]) -> str:
    """Assemble the judge prompt from the question and retrieved excerpts.

    ``contexts`` is a list of (title, body) excerpts numbered in order,
    matching how they were retrieved.
    """
    if contexts:
        excerpts = "\n\n".join(
            f"[{index}] {title}\n{body}"
            for index, (title, body) in enumerate(contexts, start=1)
        )
        return f"Question: {query}\n\nExcerpts:\n{excerpts}"
    return f"Question: {query}\n\nExcerpts: (none)"


def rewrite_query_user_prompt(query: str, history: list[tuple[str, str]]) -> str:
    """Assemble the rewrite prompt from recent turns and the question.

    ``history`` is a list of (role, content) turns, most recent last;
    it lets follow-up questions like \"what about its pricing?\" resolve
    to a standalone query.
    """
    parts: list[str] = []
    if history:
        transcript = "\n".join(
            f"{role.capitalize()}: {content}" for role, content in history
        )
        parts.append(f"Conversation so far:\n{transcript}")
    parts.append(f"Question: {query}")
    return "\n\n".join(parts)


def chat_user_prompt(
    query: str, history: list[tuple[str, str]], contexts: list[tuple[str, str]]
) -> str:
    """Assemble the grounded user prompt from history and retrieved posts.

    ``history`` is a list of (role, content) turns, most recent last.
    ``contexts`` is a list of (title, body) excerpts numbered in order,
    which the model is expected to cite as [1], [2], ...
    """
    parts: list[str] = []

    if history:
        transcript = "\n".join(
            f"{role.capitalize()}: {content}" for role, content in history
        )
        parts.append(f"Conversation so far:\n{transcript}")

    if contexts:
        excerpts = "\n\n".join(
            f"[{index}] {title}\n{body}"
            for index, (title, body) in enumerate(contexts, start=1)
        )
        parts.append(f"Relevant blog posts:\n{excerpts}")

    parts.append(f"Question: {query}")
    return "\n\n".join(parts)


FEED_AGENT_PROMPT = (
    "You pick the blend preset for a blogger's recommendation feed.\n"
    "- fresh: only recent posts, for users who want what is new\n"
    "- balanced: the standard mix of taste-matched posts\n"
    "- explorer: mostly taste-matched with some deliberate surprises\n"
    "Answer with exactly one word: fresh, balanced, or explorer."
)


def feed_agent_user_prompt(profile_summary: str) -> str:
    """Describe one user's taste profile for the blend decision."""
    return f"User taste profile:\n{profile_summary}"
