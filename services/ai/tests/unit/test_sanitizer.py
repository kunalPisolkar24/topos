from src.utils.sanitizer import Sanitizer

def test_sanitizer_allows_safe_tags():
    html = '<h2>Title</h2><p>Text</p><strong>Bold</strong>'
    cleaned = Sanitizer.clean_post_html(html)
    assert cleaned == html

def test_sanitizer_removes_scripts():
    html = '<script>alert("hack")</script><p>Content</p>'
    cleaned = Sanitizer.clean_post_html(html)
    assert '<script>' not in cleaned
    assert '<p>Content</p>' in cleaned

def test_sanitizer_strips_iframe_but_keeps_img():
    html = (
        '<iframe src="https://youtube.com/embed/123" width="500"></iframe>'
        '<img src="image.jpg" alt="test" style="width: 100%;">'
    )
    cleaned = Sanitizer.clean_post_html(html)
    assert '<iframe' not in cleaned
    assert '<img' in cleaned
    assert 'style="width: 100%;"' in cleaned

def test_sanitizer_removes_on_attributes():
    html = '<img src="x" onerror="alert(1)">'
    cleaned = Sanitizer.clean_post_html(html)
    assert 'onerror' not in cleaned
    assert '<img' in cleaned