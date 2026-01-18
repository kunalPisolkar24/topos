import re
from bs4 import BeautifulSoup

class TextCleaner:
    @staticmethod
    def clean_html(html_content: str) -> str:
        if not html_content:
            return ""
        soup = BeautifulSoup(html_content, "lxml")
        for tag in soup(["script", "style", "iframe", "noscript"]):
            tag.decompose()
        return soup.get_text(separator=" ", strip=True)

    @staticmethod
    def extract_json_block(text: str) -> str:
        pattern = r"```json\s*(\{.*\}|\[.*\])\s*```"
        match = re.search(pattern, text, re.DOTALL)
        if match:
            return match.group(1).strip()
        
        fallback_pattern = r"(\{.*\}|\[.*\])"
        match = re.search(fallback_pattern, text, re.DOTALL)
        if match:
            return match.group(1).strip()
            
        return text