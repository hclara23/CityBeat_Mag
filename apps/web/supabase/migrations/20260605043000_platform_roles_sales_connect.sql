-- Platform roles, Stripe Connect payout accounts, CRM, and revenue ledger.
-- This is additive and keeps the existing is_editor/is_writer/is_advertiser flags working.

alter table public.profiles
  add column if not exists role text default 'visitor',
  add column if not exists is_developer boolean default false,
  add column if not exists is_sales boolean default false,
  add column if not exists sales_dashboard_enabled boolean default false,
  add column if not exists stripe_connected_account_id text,
  add column if not exists stripe_connect_onboarding_complete boolean default false;

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('visitor', 'contributor', 'writer', 'editor', 'admin', 'developer', 'sales', 'advertiser'));

create table if not exists public.profile_roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('developer', 'admin', 'editor', 'writer', 'contributor', 'sales', 'advertiser')),
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (profile_id, role)
);

create table if not exists public.stripe_connected_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  stripe_account_id text not null unique,
  account_type text not null default 'express',
  country text not null default 'US',
  default_currency text not null default 'usd',
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  onboarding_complete boolean not null default false,
  requirements_currently_due text[] not null default '{}',
  requirements_past_due text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.revenue_splits (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  product_type text not null default 'any',
  developer_percent numeric(5,2) not null,
  admin_percent numeric(5,2) not null,
  sales_percent numeric(5,2) not null default 0,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint revenue_splits_percent_check check (
    developer_percent >= 0
    and admin_percent >= 0
    and sales_percent >= 0
    and developer_percent + admin_percent + sales_percent = 100
  )
);

insert into public.revenue_splits (key, name, product_type, developer_percent, admin_percent, sales_percent, is_default)
values
  ('admin_direct_default', 'Admin direct sale default', 'any', 40, 60, 0, true),
  ('sales_assisted_default', 'Sales assisted default', 'any', 30, 30, 40, false)
on conflict (key) do update set
  developer_percent = excluded.developer_percent,
  admin_percent = excluded.admin_percent,
  sales_percent = excluded.sales_percent,
  is_default = excluded.is_default,
  updated_at = now();

create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique,
  staff_id uuid references public.profiles(id) on delete set null,
  customer_profile_id uuid references public.profiles(id) on delete set null,
  business_listing_id uuid references public.directory_listings(id) on delete set null,
  customer_email text,
  customer_name text,
  customer_phone text,
  product_type text not null check (product_type in ('directory_premium', 'ad', 'website', 'sponsored_content', 'other')),
  status text not null default 'draft' check (status in ('draft', 'payment_pending', 'paid', 'partially_refunded', 'refunded', 'void')),
  gross_amount_cents integer not null default 0 check (gross_amount_cents >= 0),
  currency text not null default 'usd',
  split_key text references public.revenue_splits(key),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_customer_id text,
  sales_channel text not null default 'staff_dashboard',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sales_orders(id) on delete cascade,
  name text not null,
  description text,
  quantity integer not null default 1 check (quantity > 0),
  unit_amount_cents integer not null check (unit_amount_cents >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.revenue_ledger (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sales_orders(id) on delete cascade,
  beneficiary_profile_id uuid references public.profiles(id) on delete set null,
  beneficiary_role text not null check (beneficiary_role in ('developer', 'admin', 'sales')),
  share_percent numeric(5,2) not null check (share_percent >= 0 and share_percent <= 100),
  gross_amount_cents integer not null check (gross_amount_cents >= 0),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'usd',
  stripe_transfer_id text,
  stripe_connected_account_id text,
  status text not null default 'pending' check (status in ('pending', 'transfer_pending', 'transferred', 'retained', 'failed', 'reversed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  source_listing_id uuid references public.directory_listings(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  business_name text not null,
  contact_name text,
  email text,
  phone text,
  website text,
  address text,
  category text,
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost', 'do_not_contact')),
  estimated_value_cents integer not null default 0 check (estimated_value_cents >= 0),
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  activity_type text not null check (activity_type in ('call', 'email', 'walk_in', 'note', 'proposal', 'checkout', 'follow_up')),
  outcome text,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_profile_roles_profile_id on public.profile_roles(profile_id);
create index if not exists idx_profile_roles_role on public.profile_roles(role) where revoked_at is null;
create index if not exists idx_stripe_connected_accounts_profile on public.stripe_connected_accounts(profile_id);
create index if not exists idx_sales_orders_staff on public.sales_orders(staff_id);
create index if not exists idx_sales_orders_status on public.sales_orders(status);
create index if not exists idx_revenue_ledger_beneficiary on public.revenue_ledger(beneficiary_profile_id);
create index if not exists idx_crm_leads_assigned_to on public.crm_leads(assigned_to);
create index if not exists idx_crm_leads_status on public.crm_leads(status);
create index if not exists idx_crm_leads_source_listing on public.crm_leads(source_listing_id);
create index if not exists idx_crm_activities_lead on public.crm_activities(lead_id);

create or replace function public.has_platform_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        (required_role = 'developer' and (p.is_developer = true or p.role = 'developer'))
        or (required_role = 'admin' and (p.is_developer = true or p.is_editor = true or p.role in ('developer', 'admin', 'editor')))
        or (required_role = 'editor' and (p.is_developer = true or p.is_editor = true or p.role in ('developer', 'admin', 'editor')))
        or (required_role = 'writer' and (p.is_developer = true or p.is_editor = true or p.is_writer = true or p.role in ('developer', 'admin', 'editor', 'writer')))
        or (required_role = 'sales' and (p.is_developer = true or p.is_editor = true or p.is_sales = true or p.sales_dashboard_enabled = true or p.role in ('developer', 'admin', 'editor', 'sales')))
        or exists (
          select 1
          from public.profile_roles pr
          where pr.profile_id = p.id
            and pr.revoked_at is null
            and (
              pr.role = required_role
              or (required_role = 'admin' and pr.role in ('developer', 'admin', 'editor'))
              or (required_role = 'editor' and pr.role in ('developer', 'admin', 'editor'))
              or (required_role = 'writer' and pr.role in ('developer', 'admin', 'editor', 'writer'))
              or (required_role = 'sales' and pr.role in ('developer', 'admin', 'editor', 'sales'))
            )
        )
      )
  );
$$;

create or replace function public.has_sales_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_platform_role('sales');
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'profiles_touch_updated_at') then
    create trigger profiles_touch_updated_at
    before update on public.profiles
    for each row execute function public.touch_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'stripe_connected_accounts_touch_updated_at') then
    create trigger stripe_connected_accounts_touch_updated_at
    before update on public.stripe_connected_accounts
    for each row execute function public.touch_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'revenue_splits_touch_updated_at') then
    create trigger revenue_splits_touch_updated_at
    before update on public.revenue_splits
    for each row execute function public.touch_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'sales_orders_touch_updated_at') then
    create trigger sales_orders_touch_updated_at
    before update on public.sales_orders
    for each row execute function public.touch_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'revenue_ledger_touch_updated_at') then
    create trigger revenue_ledger_touch_updated_at
    before update on public.revenue_ledger
    for each row execute function public.touch_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'crm_leads_touch_updated_at') then
    create trigger crm_leads_touch_updated_at
    before update on public.crm_leads
    for each row execute function public.touch_updated_at();
  end if;
end $$;

alter table public.profile_roles enable row level security;
alter table public.stripe_connected_accounts enable row level security;
alter table public.revenue_splits enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
alter table public.revenue_ledger enable row level security;
alter table public.crm_leads enable row level security;
alter table public.crm_activities enable row level security;

drop policy if exists "Admins read profiles" on public.profiles;
create policy "Admins read profiles" on public.profiles
  for select using (auth.uid() = id or public.has_platform_role('admin'));

drop policy if exists "Admins update profiles" on public.profiles;
create policy "Admins update profiles" on public.profiles
  for update using (auth.uid() = id or public.has_platform_role('admin'))
  with check (auth.uid() = id or public.has_platform_role('admin'));

drop policy if exists "Users read own profile roles" on public.profile_roles;
create policy "Users read own profile roles" on public.profile_roles
  for select using (profile_id = auth.uid() or public.has_platform_role('admin'));

drop policy if exists "Admins manage profile roles" on public.profile_roles;
create policy "Admins manage profile roles" on public.profile_roles
  for all using (public.has_platform_role('admin'))
  with check (public.has_platform_role('admin'));

drop policy if exists "Users read own connected account" on public.stripe_connected_accounts;
create policy "Users read own connected account" on public.stripe_connected_accounts
  for select using (profile_id = auth.uid() or public.has_platform_role('admin'));

drop policy if exists "Users manage own connected account record" on public.stripe_connected_accounts;
create policy "Users manage own connected account record" on public.stripe_connected_accounts
  for all using (profile_id = auth.uid() or public.has_platform_role('admin'))
  with check (profile_id = auth.uid() or public.has_platform_role('admin'));

drop policy if exists "Admins read revenue splits" on public.revenue_splits;
create policy "Admins read revenue splits" on public.revenue_splits
  for select using (public.has_platform_role('admin') or public.has_sales_access());

drop policy if exists "Developers manage revenue splits" on public.revenue_splits;
create policy "Developers manage revenue splits" on public.revenue_splits
  for all using (public.has_platform_role('developer'))
  with check (public.has_platform_role('developer'));

drop policy if exists "Sales dashboard reads relevant orders" on public.sales_orders;
create policy "Sales dashboard reads relevant orders" on public.sales_orders
  for select using (
    public.has_platform_role('admin')
    or staff_id = auth.uid()
    or customer_profile_id = auth.uid()
  );

drop policy if exists "Sales users create orders" on public.sales_orders;
create policy "Sales users create orders" on public.sales_orders
  for insert with check (public.has_sales_access() and (staff_id = auth.uid() or public.has_platform_role('admin')));

drop policy if exists "Sales users update own draft orders" on public.sales_orders;
create policy "Sales users update own draft orders" on public.sales_orders
  for update using (public.has_platform_role('admin') or staff_id = auth.uid())
  with check (public.has_platform_role('admin') or staff_id = auth.uid());

drop policy if exists "Sales dashboard reads order items" on public.sales_order_items;
create policy "Sales dashboard reads order items" on public.sales_order_items
  for select using (
    exists (
      select 1 from public.sales_orders so
      where so.id = order_id
        and (public.has_platform_role('admin') or so.staff_id = auth.uid() or so.customer_profile_id = auth.uid())
    )
  );

drop policy if exists "Sales users manage order items" on public.sales_order_items;
create policy "Sales users manage order items" on public.sales_order_items
  for all using (
    exists (
      select 1 from public.sales_orders so
      where so.id = order_id
        and (public.has_platform_role('admin') or so.staff_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.sales_orders so
      where so.id = order_id
        and (public.has_platform_role('admin') or so.staff_id = auth.uid())
    )
  );

drop policy if exists "Users read own revenue ledger" on public.revenue_ledger;
create policy "Users read own revenue ledger" on public.revenue_ledger
  for select using (public.has_platform_role('admin') or beneficiary_profile_id = auth.uid());

drop policy if exists "Admins manage revenue ledger" on public.revenue_ledger;
create policy "Admins manage revenue ledger" on public.revenue_ledger
  for all using (public.has_platform_role('admin'))
  with check (public.has_platform_role('admin'));

drop policy if exists "Sales dashboard reads leads" on public.crm_leads;
create policy "Sales dashboard reads leads" on public.crm_leads
  for select using (public.has_platform_role('admin') or assigned_to = auth.uid() or (assigned_to is null and public.has_sales_access()));

drop policy if exists "Sales users manage leads" on public.crm_leads;
create policy "Sales users manage leads" on public.crm_leads
  for all using (public.has_platform_role('admin') or assigned_to = auth.uid() or (assigned_to is null and public.has_sales_access()))
  with check (public.has_platform_role('admin') or assigned_to = auth.uid() or (assigned_to is null and public.has_sales_access()));

drop policy if exists "Sales dashboard reads lead activities" on public.crm_activities;
create policy "Sales dashboard reads lead activities" on public.crm_activities
  for select using (
    exists (
      select 1 from public.crm_leads cl
      where cl.id = lead_id
        and (public.has_platform_role('admin') or cl.assigned_to = auth.uid() or (cl.assigned_to is null and public.has_sales_access()))
    )
  );

drop policy if exists "Sales users manage lead activities" on public.crm_activities;
create policy "Sales users manage lead activities" on public.crm_activities
  for all using (
    exists (
      select 1 from public.crm_leads cl
      where cl.id = lead_id
        and (public.has_platform_role('admin') or cl.assigned_to = auth.uid() or (cl.assigned_to is null and public.has_sales_access()))
    )
  )
  with check (
    exists (
      select 1 from public.crm_leads cl
      where cl.id = lead_id
        and (public.has_platform_role('admin') or cl.assigned_to = auth.uid() or (cl.assigned_to is null and public.has_sales_access()))
    )
  );
