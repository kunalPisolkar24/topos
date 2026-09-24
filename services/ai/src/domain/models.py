from dataclasses import dataclass

from pydantic import BaseModel


class GeneratedPost(BaseModel):
    title: str
    body: str
    summary: str
    tags: list[str]


@dataclass
class SearchResult:
    post_ids: list[str]
    total: int


@dataclass
class RetrievedPost:
    """A post retrieved as grounding context for the chat assistant."""

    post_id: str
    title: str
    body: str
