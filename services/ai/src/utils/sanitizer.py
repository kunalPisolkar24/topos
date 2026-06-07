import bleach
from bleach.css_sanitizer import CSSSanitizer


class Sanitizer:
    ALLOWED_TAGS = [
        'a', 'abbr', 'acronym', 'b', 'blockquote', 'br', 'code', 'div',
        'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'iframe',
        'img', 'li', 'ol', 'p', 'pre', 'span', 'strike', 'strong',
        'sub', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead',
        'tr', 'u', 'ul', 'video'
    ]

    ALLOWED_ATTRIBUTES = {
        'a': ['href', 'title', 'target', 'rel'],
        'img': ['src', 'alt', 'title', 'width', 'height', 'style'],
        'iframe': ['src', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen', 'style'],
        'video': ['src', 'width', 'height', 'controls', 'poster', 'preload', 'style'],
        'table': ['border', 'cellpadding', 'cellspacing', 'style'],
        'td': ['colspan', 'rowspan', 'style'],
        'th': ['colspan', 'rowspan', 'style'],
        '*': ['class', 'style']
    }

    ALLOWED_STYLES = [
        'color', 'background-color', 'font-family', 'font-size',
        'font-weight', 'font-style', 'text-align', 'text-decoration',
        'width', 'height', 'margin', 'padding', 'border', 'display',
        'float', 'vertical-align', 'white-space'
    ]

    ALLOWED_PROTOCOLS = ['http', 'https', 'mailto']

    @classmethod
    def clean_post_html(cls, html_content: str) -> str:
        if not html_content:
            return ""

        css_sanitizer = CSSSanitizer(allowed_css_properties=cls.ALLOWED_STYLES)

        return bleach.clean(
            html_content,
            tags=cls.ALLOWED_TAGS,
            attributes=cls.ALLOWED_ATTRIBUTES,
            protocols=cls.ALLOWED_PROTOCOLS,
            css_sanitizer=css_sanitizer,
            strip=True
        )
