from pydantic import BaseModel
from typing import List

class GeneratedPost(BaseModel):
    title: str
    body: str
    summary: str
    tags: List[str]