create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  locale text not null default 'en',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS
alter table public.newsletter_subscribers enable row level security;

-- Policies
create policy "Anyone can subscribe to the newsletter." on public.newsletter_subscribers
  for insert with check (true);

create policy "Newsletter subscribers are viewable by authenticated users (admins)." on public.newsletter_subscribers
  for select using (auth.role() = 'authenticated');
