-- Baton organization-scoped API schema. Run with the Supabase service-role SQL editor.
create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.org_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  role text not null default 'member' check (role in ('admin','member','team')),
  github_login text,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table if not exists public.repositories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  installation_id text not null,
  github_repo_id bigint,
  full_name text not null,
  default_branch text,
  private boolean not null default true,
  synced_at timestamptz,
  last_synced_at timestamptz,
  github_repository_id bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (org_id, full_name)
);

-- Retain compatibility with the initial dashboard schema while tightening its policies.
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  author_id text,
  author text not null default 'Agent',
  author_login text,
  content text not null,
  type text not null,
  external_id text,
  url text,
  sha text,
  committer jsonb,
  metadata jsonb not null default '{}'::jsonb,
  repository_id uuid references public.repositories(id) on delete set null,
  session_id text,
  event_id text,
  visibility text not null default 'team' check (visibility in ('team','admin','private')),
  created_at timestamptz not null default now(),
  timestamp timestamptz not null default now()
);
alter table public.sources add column if not exists author_id uuid references auth.users(id) on delete set null;
drop policy if exists sources_member_read on public.sources;
drop policy if exists sources_member_insert on public.sources;
drop policy if exists sources_owner_update on public.sources;
drop policy if exists sources_owner_delete on public.sources;
drop policy if exists "Allow read access to authenticated users on sources" on public.sources;
drop policy if exists "Allow insert access on sources" on public.sources;
alter table public.sources drop constraint if exists sources_author_id_fkey;
alter table public.sources alter column author_id type text using author_id::text;
alter table public.sources add column if not exists author_login text;
alter table public.sources add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.sources add column if not exists external_id text;
alter table public.sources add column if not exists url text;
alter table public.sources add column if not exists sha text;
alter table public.sources add column if not exists committer jsonb;
alter table public.sources add column if not exists repository_id uuid references public.repositories(id) on delete set null;
alter table public.sources add column if not exists session_id text;
alter table public.sources add column if not exists event_id text;
alter table public.sources add column if not exists visibility text not null default 'team';
alter table public.sources add column if not exists created_at timestamptz not null default now();
create unique index if not exists sources_event_dedupe on public.sources(org_id, author_id, session_id, event_id) where event_id is not null;
create unique index if not exists sources_external_dedupe on public.sources(org_id, repository_id, external_id) where external_id is not null;
create index if not exists sources_org_created_idx on public.sources(org_id, created_at desc);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text not null default '',
  assignee_id uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open','in_progress','done','cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  parent_id uuid references public.task_comments(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  token_hash text not null unique,
  email text,
  role text not null check (role in ('member','team')),
  created_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.handovers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  leaver_id uuid references auth.users(id) on delete set null,
  incoming_id uuid references auth.users(id) on delete set null,
  status text not null default 'draft',
  version integer not null default 0,
  approved_version integer,
  generation_mode text,
  summary text,
  generated_content jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.handover_claims (
  id uuid primary key default gen_random_uuid(),
  handover_id uuid not null references public.handovers(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  claim text,
  text text not null,
  section text,
  evidence jsonb not null default '[]'::jsonb,
  source_ids jsonb not null default '[]'::jsonb,
  confidence text,
  generated_by text,
  status text not null default 'unreviewed',
  visibility text not null default 'team',
  review_text text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table if not exists public.handover_questions (
  id uuid primary key default gen_random_uuid(),
  handover_id uuid not null references public.handovers(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  asked_by uuid references auth.users(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  question_text text not null,
  answer text,
  answered_by uuid references auth.users(id) on delete set null,
  answered_at timestamptz,
  source_ids jsonb not null default '[]'::jsonb,
  risk text,
  visibility text not null default 'team',
  status text not null default 'open',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.handover_versions (
  id uuid primary key default gen_random_uuid(),
  handover_id uuid not null references public.handovers(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  version_number integer not null,
  status text not null default 'draft',
  snapshot jsonb not null default '{}'::jsonb,
  source_ids jsonb not null default '[]'::jsonb,
  source_fingerprints jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (handover_id, version_number)
);
create table if not exists public.handover_events (
  id uuid primary key default gen_random_uuid(),
  handover_id uuid not null references public.handovers(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.github_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  github_user_id text not null,
  github_login text not null,
  access_token text not null,
  token_type text not null default 'bearer',
  scope text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create table if not exists public.github_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  state_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists public.github_deliveries (
  id uuid primary key default gen_random_uuid(),
  delivery_id text not null unique,
  event text not null,
  repository_id uuid references public.repositories(id) on delete set null,
  processed_at timestamptz not null default now()
);

create table if not exists public.github_link_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  state_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists public.github_installations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  installation_id text not null,
  account_login text,
  account_type text,
  connected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, installation_id)
);

-- Legacy dashboard tables are now organization-scoped too.
create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  decision text not null, reason text not null, alternatives text[] not null default '{}',
  files_affected text[] not null default '{}', status text not null default 'Verified',
  citation text not null default 'Agent Session', created_at timestamptz not null default now()
);
alter table public.decisions add column if not exists org_id uuid references public.organizations(id) on delete cascade;
create table if not exists public.blockers (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  problem text not null, status text not null default 'active' check (status in ('active','investigating','blocked','workaround_applied','resolved')),
  workaround_notes text not null default '', citation text not null default 'Agent Session', created_at timestamptz not null default now()
);
alter table public.blockers add column if not exists org_id uuid references public.organizations(id) on delete cascade;

create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = public, auth
as $$ select exists (select 1 from public.org_memberships m where m.org_id = target_org and m.user_id = auth.uid() and m.disabled_at is null) $$;
create or replace function public.is_org_admin(target_org uuid)
returns boolean language sql stable security definer set search_path = public, auth
as $$ select exists (select 1 from public.org_memberships m where m.org_id = target_org and m.user_id = auth.uid() and m.role = 'admin' and m.disabled_at is null) $$;
create or replace function public.keep_org_admin()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
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
drop trigger if exists org_memberships_keep_admin on public.org_memberships;
create trigger org_memberships_keep_admin before update or delete on public.org_memberships
for each row execute function public.keep_org_admin();

alter table public.organizations enable row level security;
alter table public.org_memberships enable row level security;
alter table public.repositories enable row level security;
alter table public.sources enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.organization_invites enable row level security;
alter table public.api_tokens enable row level security;
alter table public.handovers enable row level security;
alter table public.handover_claims enable row level security;
alter table public.handover_questions enable row level security;
alter table public.handover_versions enable row level security;
alter table public.handover_events enable row level security;
alter table public.github_link_states enable row level security;
alter table public.github_installations enable row level security;
alter table public.github_accounts enable row level security;
alter table public.github_states enable row level security;
alter table public.github_deliveries enable row level security;
alter table public.decisions enable row level security;
alter table public.blockers enable row level security;

drop policy if exists "Allow read access to authenticated users on sources" on public.sources;
drop policy if exists "Allow insert access on sources" on public.sources;
drop policy if exists "Allow read access to authenticated users" on public.decisions;
drop policy if exists "Allow insert access to authenticated users" on public.decisions;
drop policy if exists "Allow read access to authenticated users on blockers" on public.blockers;
drop policy if exists "Allow insert access to authenticated users on blockers" on public.blockers;
drop policy if exists organizations_member_read on public.organizations;
drop policy if exists organizations_member_insert on public.organizations;
drop policy if exists organizations_admin_update on public.organizations;
drop policy if exists memberships_org_read on public.org_memberships;
drop policy if exists memberships_admin_write on public.org_memberships;
drop policy if exists repositories_member_access on public.repositories;
drop policy if exists sources_member_read on public.sources;
drop policy if exists sources_member_insert on public.sources;
drop policy if exists sources_owner_update on public.sources;
drop policy if exists sources_owner_delete on public.sources;
drop policy if exists tasks_member_access on public.tasks;
drop policy if exists task_comments_member_access on public.task_comments;
drop policy if exists handovers_member_read on public.handovers;
drop policy if exists handovers_admin_insert on public.handovers;
drop policy if exists handovers_admin_update on public.handovers;
drop policy if exists handover_claims_member_access on public.handover_claims;
drop policy if exists handover_questions_member_access on public.handover_questions;
drop policy if exists handover_versions_member_read on public.handover_versions;
drop policy if exists handover_events_member_read on public.handover_events;
drop policy if exists decisions_member_access on public.decisions;
drop policy if exists blockers_member_access on public.blockers;

create policy organizations_member_read on public.organizations for select to authenticated using (public.is_org_member(id));
create policy organizations_member_insert on public.organizations for insert to authenticated with check (created_by = auth.uid());
create policy organizations_admin_update on public.organizations for update to authenticated using (public.is_org_admin(id)) with check (public.is_org_admin(id));
create policy memberships_org_read on public.org_memberships for select to authenticated using (public.is_org_member(org_id));
create policy memberships_admin_write on public.org_memberships for all to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
create policy repositories_member_access on public.repositories for select to authenticated using (public.is_org_member(org_id));
create policy sources_member_read on public.sources for select to authenticated using (
  public.is_org_member(org_id) and (visibility <> 'admin' or public.is_org_admin(org_id))
  and (visibility <> 'private' or author_id = auth.uid()::text or public.is_org_admin(org_id))
);
create policy sources_member_insert on public.sources for insert to authenticated with check (public.is_org_member(org_id) and author_id = auth.uid()::text);
create policy sources_owner_update on public.sources for update to authenticated using (public.is_org_member(org_id) and author_id = auth.uid()::text and external_id is null and type <> 'github_evidence') with check (public.is_org_member(org_id) and author_id = auth.uid()::text and external_id is null and type <> 'github_evidence');
create policy sources_owner_delete on public.sources for delete to authenticated using (public.is_org_member(org_id) and author_id = auth.uid()::text and external_id is null and type <> 'github_evidence');
create policy tasks_member_access on public.tasks for all to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy task_comments_member_access on public.task_comments for all to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy handovers_member_read on public.handovers for select to authenticated using (public.is_org_member(org_id));
create policy handovers_admin_insert on public.handovers for insert to authenticated with check (public.is_org_admin(org_id));
create policy handovers_admin_update on public.handovers for update to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
create policy handover_claims_member_access on public.handover_claims for select to authenticated using (public.is_org_member(org_id));
create policy handover_questions_member_access on public.handover_questions for select to authenticated using (public.is_org_member(org_id));
create policy handover_versions_member_read on public.handover_versions for select to authenticated using (public.is_org_member(org_id));
create policy handover_events_member_read on public.handover_events for select to authenticated using (public.is_org_member(org_id));
create policy decisions_member_access on public.decisions for select to authenticated using (org_id is not null and public.is_org_member(org_id));
create policy blockers_member_access on public.blockers for select to authenticated using (org_id is not null and public.is_org_member(org_id));

-- Invites, API tokens, GitHub OAuth/account state, deliveries and installations have no client policies;
-- access is only through the server's service-role client.