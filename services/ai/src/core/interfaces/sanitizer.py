from abc import ABC, abstractmethod

class SanitizerInterface(ABC):
    @abstractmethod
    def clean_post_html(self, html_content: str) -> str:
        pass
