create table public.events (
  id uuid primary key default gen_random_uuid(),
  title_en text not null,
  title_es text not null,
  meta_en text,
  meta_es text,
  image_url text,
  ticket_url text,
  start_date timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS
alter table public.events enable row level security;

-- Policies
create policy "Events are viewable by everyone." on public.events
  for select using (true);

create policy "Events can be inserted by authenticated users (scraper bot)." on public.events
  for insert with check (auth.role() = 'authenticated');

create policy "Events can be updated by authenticated users (scraper bot)." on public.events
  for update using (auth.role() = 'authenticated');
