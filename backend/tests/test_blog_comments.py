from routes.blog_comments import _strip_comment_body


def test_strip_comment_body():
    assert _strip_comment_body("  hello  ") == "hello"
    assert _strip_comment_body("<b>x</b>") == "x"
