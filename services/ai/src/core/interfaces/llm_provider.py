from abc import ABC, abstractmethod

class LLMProvider(ABC):
    @abstractmethod
    async def generate_completion(self, system_prompt: str, user_content: str) -> str:
        pass