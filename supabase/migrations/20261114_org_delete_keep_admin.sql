-- Lets an organization be deleted: its memberships cascade after the organization row is gone,
-- which the last-admin guard previously rejected (DELETE /api/orgs/:id returned 500).
-- Safe to run more than once.

create or replace function public.keep_org_admin()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  -- Deleting the organization cascades to its memberships; the parent row is already gone then.
  if not exists (select 1 from public.organizations where id = old.org_id) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if old.role = 'admin' and old.disabled_at is null
    and (tg_op = 'DELETE' or new.role <> 'admin' or new.disabled_at is not null) then
    perform 1 from public.organizations where id = old.org_id for update;
    if not exists (
      select 1 from public.org_memberships m
      where m.org_id = old.org_id and m.id <> old.id and m.role = 'admin' and m.disabled_at is null
    ) then
      raise exception 'organization must retain at least one active admin' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
