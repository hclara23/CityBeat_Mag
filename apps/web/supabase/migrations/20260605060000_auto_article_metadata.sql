-- Metadata for source-backed automated article drafts.

alter table public.articles
  add column if not exists generated_by text,
  add column if not exists source_urls text[] not null default '{}'::text[],
  add column if not exists source_published_at timestamptz,
  add column if not exists generation_metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_articles_generated_by_created_at
  on public.articles(generated_by, created_at desc)
  where generated_by is not null;

create index if not exists idx_articles_source_urls
  on public.articles using gin(source_urls);
