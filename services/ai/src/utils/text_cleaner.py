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
    def _find_balanced_block(text: str, start_char: str, end_char: str):
        depth = 0
        start_idx = None
        for i, char in enumerate(text):
            if char == start_char:
                if depth == 0:
                    start_idx = i
                depth += 1
            elif char == end_char:
                depth -= 1
                if depth == 0 and start_idx is not None:
                    return text[start_idx:i+1].strip()
        return None

    @staticmethod
    def extract_json_block(text: str) -> str:
        patterns = [
            r"```json\s*(\{.*\}|\[.*\])\s*```",
            r"```\s*(\{.*\}|\[.*\])\s*```",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.DOTALL)
            if match:
                return match.group(1).strip()
            
        result = TextCleaner._find_balanced_block(text, "{", "}")
        if result is not None:
            return result

        result = TextCleaner._find_balanced_block(text, "[", "]")
        if result is not None:
            return result

        return text.strip()