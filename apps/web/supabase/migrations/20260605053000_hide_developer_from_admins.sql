-- Keep developer owner accounts invisible to admin-level users.
-- Developers retain full visibility; admins can manage non-developer staff.

create or replace function public.is_developer_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = target_profile_id
      and (
        p.is_developer = true
        or p.role = 'developer'
        or exists (
          select 1
          from public.profile_roles pr
          where pr.profile_id = target_profile_id
            and pr.role = 'developer'
            and pr.revoked_at is null
        )
      )
  );
$$;

drop policy if exists "Admins read profiles" on public.profiles;
create policy "Admins read profiles" on public.profiles
  for select using (
    auth.uid() = id
    or public.has_platform_role('developer')
    or (
      public.has_platform_role('admin')
      and not public.is_developer_profile(id)
    )
  );

drop policy if exists "Admins update profiles" on public.profiles;
create policy "Admins update profiles" on public.profiles
  for update using (
    public.has_platform_role('developer')
    or (
      public.has_platform_role('admin')
      and not public.is_developer_profile(id)
    )
    or (
      auth.uid() = id
      and not public.is_developer_profile(id)
    )
  )
  with check (
    public.has_platform_role('developer')
    or (
      public.has_platform_role('admin')
      and not public.is_developer_profile(id)
    )
    or (
      auth.uid() = id
      and not public.is_developer_profile(id)
    )
  );

drop policy if exists "Users read own profile roles" on public.profile_roles;
create policy "Users read own profile roles" on public.profile_roles
  for select using (
    profile_id = auth.uid()
    or public.has_platform_role('developer')
    or (
      public.has_platform_role('admin')
      and not public.is_developer_profile(profile_id)
    )
  );

drop policy if exists "Admins manage profile roles" on public.profile_roles;
create policy "Admins manage profile roles" on public.profile_roles
  for all using (
    public.has_platform_role('developer')
    or (
      public.has_platform_role('admin')
      and role <> 'developer'
      and not public.is_developer_profile(profile_id)
    )
  )
  with check (
    public.has_platform_role('developer')
    or (
      public.has_platform_role('admin')
      and role <> 'developer'
      and not public.is_developer_profile(profile_id)
    )
  );

drop policy if exists "Users read own connected account" on public.stripe_connected_accounts;
create policy "Users read own connected account" on public.stripe_connected_accounts
  for select using (
    profile_id = auth.uid()
    or public.has_platform_role('developer')
    or (
      public.has_platform_role('admin')
      and not public.is_developer_profile(profile_id)
    )
  );

drop policy if exists "Users manage own connected account record" on public.stripe_connected_accounts;
create policy "Users manage own connected account record" on public.stripe_connected_accounts
  for all using (
    profile_id = auth.uid()
    or public.has_platform_role('developer')
    or (
      public.has_platform_role('admin')
      and not public.is_developer_profile(profile_id)
    )
  )
  with check (
    profile_id = auth.uid()
    or public.has_platform_role('developer')
    or (
      public.has_platform_role('admin')
      and not public.is_developer_profile(profile_id)
    )
  );

drop policy if exists "Users read own revenue ledger" on public.revenue_ledger;
create policy "Users read own revenue ledger" on public.revenue_ledger
  for select using (
    public.has_platform_role('developer')
    or beneficiary_profile_id = auth.uid()
    or (
      public.has_platform_role('admin')
      and beneficiary_role <> 'developer'
      and (
        beneficiary_profile_id is null
        or not public.is_developer_profile(beneficiary_profile_id)
      )
    )
  );

drop policy if exists "Admins manage revenue ledger" on public.revenue_ledger;
create policy "Admins manage revenue ledger" on public.revenue_ledger
  for all using (
    public.has_platform_role('developer')
    or (
      public.has_platform_role('admin')
      and beneficiary_role <> 'developer'
      and (
        beneficiary_profile_id is null
        or not public.is_developer_profile(beneficiary_profile_id)
      )
    )
  )
  with check (
    public.has_platform_role('developer')
    or (
      public.has_platform_role('admin')
      and beneficiary_role <> 'developer'
      and (
        beneficiary_profile_id is null
        or not public.is_developer_profile(beneficiary_profile_id)
      )
    )
  );
