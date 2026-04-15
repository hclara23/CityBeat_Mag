INSERT INTO ad_placements (key, name, size, page_context)
VALUES ('article_inline', 'Article Inline', '728x90', 'article')
ON CONFLICT (key) DO NOTHING;
