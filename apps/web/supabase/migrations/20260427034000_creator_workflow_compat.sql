-- Compatibility columns and policies for the Creator Studio workflow.
-- This extends the initial content schema without replacing existing tables.

alter table profiles
  add column if not exists full_name text,
  add column if not exists company_name text,
  add column if not exists phone_number text,
  add column if not exists avatar_url text,
  add column if not exists is_advertiser boolean default false,
  add column if not exists is_editor boolean default false,
  add column if not exists is_writer boolean default false;

insert into categories (slug, name_en, name_es)
values
  ('news', 'News', 'Noticias'),
  ('culture', 'Culture', 'Cultura'),
  ('events', 'Events', 'Eventos'),
  ('business', 'Business', 'Negocios')
on conflict (slug) do nothing;

alter table articles
  add column if not exists title text,
  add column if not exists excerpt text,
  add column if not exists content jsonb not null default '[]'::jsonb,
  add column if not exists image_url text,
  add column if not exists status text not null default 'draft',
  add column if not exists language text not null default 'en';

create index if not exists idx_articles_created_by on articles(created_by);
create index if not exists idx_articles_status on articles(status);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamp with time zone default now()
);

create table if not exists article_tags (
  article_id uuid references articles(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (article_id, tag_id)
);

alter table tags enable row level security;
alter table article_tags enable row level security;

drop policy if exists "Public tags access" on tags;
create policy "Public tags access" on tags
  for select using (true);

drop policy if exists "Writers can create tags" on tags;
create policy "Writers can create tags" on tags
  for insert with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and (profiles.is_writer or profiles.is_editor or profiles.role in ('admin', 'editor'))
    )
  );

drop policy if exists "Article tags read access" on article_tags;
create policy "Article tags read access" on article_tags
  for select using (true);

drop policy if exists "Writers manage article tags" on article_tags;
create policy "Writers manage article tags" on article_tags
  for all using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and (profiles.is_writer or profiles.is_editor or profiles.role in ('admin', 'editor'))
    )
  );

drop policy if exists "Writers create articles" on articles;
create policy "Writers create articles" on articles
  for insert with check (
    created_by = auth.uid()
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and (profiles.is_writer or profiles.is_editor or profiles.role in ('admin', 'editor'))
    )
  );

drop policy if exists "Writers update own articles" on articles;
create policy "Writers update own articles" on articles
  for update using (
    created_by = auth.uid()
    or exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and (profiles.is_editor or profiles.role in ('admin', 'editor'))
    )
  );
