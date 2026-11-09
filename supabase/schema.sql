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
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (org_id, full_name)
);

-- Retain compatibility with the initial dashboard schema while tightening its policies.
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author text not null default 'Agent',
  content text not null,
  type text not null,
  metadata jsonb not null default '{}'::jsonb,
  repository_id uuid references public.repositories(id) on delete set null,
  session_id text,
  event_id text,
  visibility text not null default 'team' check (visibility in ('team','admin','private')),
  created_at timestamptz not null default now(),
  timestamp timestamptz not null default now()
);
alter table public.sources add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table public.sources add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.sources add column if not exists repository_id uuid references public.repositories(id) on delete set null;
alter table public.sources add column if not exists session_id text;
alter table public.sources add column if not exists event_id text;
alter table public.sources add column if not exists visibility text not null default 'team';
alter table public.sources add column if not exists created_at timestamptz not null default now();
create unique index if not exists sources_event_dedupe on public.sources(org_id, author_id, session_id, event_id) where event_id is not null;
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
  summary text,
  generated_content jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.handover_claims (
  id uuid primary key default gen_random_uuid(),
  handover_id uuid not null references public.handovers(id) on delete cascade,
  claim text not null,
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'unreviewed',
  review_text text,
  created_at timestamptz not null default now()
);
create table if not exists public.handover_questions (
  id uuid primary key default gen_random_uuid(),
  handover_id uuid not null references public.handovers(id) on delete cascade,
  asked_by uuid references auth.users(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  question text not null,
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now()
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
alter table public.github_link_states enable row level security;
alter table public.github_installations enable row level security;
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
  and (visibility <> 'private' or author_id = auth.uid() or public.is_org_admin(org_id))
);
create policy sources_member_insert on public.sources for insert to authenticated with check (public.is_org_member(org_id) and author_id = auth.uid());
create policy sources_owner_update on public.sources for update to authenticated using (public.is_org_member(org_id) and author_id = auth.uid() and type <> 'github_evidence') with check (public.is_org_member(org_id) and author_id = auth.uid() and type <> 'github_evidence');
create policy sources_owner_delete on public.sources for delete to authenticated using (public.is_org_member(org_id) and author_id = auth.uid() and type <> 'github_evidence');
create policy tasks_member_access on public.tasks for all to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy task_comments_member_access on public.task_comments for all to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy handovers_member_read on public.handovers for select to authenticated using (public.is_org_member(org_id));
create policy handovers_admin_insert on public.handovers for insert to authenticated with check (public.is_org_admin(org_id));
create policy handovers_admin_update on public.handovers for update to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
create policy handover_claims_member_access on public.handover_claims for select to authenticated using (exists (select 1 from public.handovers h where h.id = handover_id and public.is_org_member(h.org_id)));
create policy handover_questions_member_access on public.handover_questions for select to authenticated using (exists (select 1 from public.handovers h where h.id = handover_id and public.is_org_member(h.org_id)));
create policy decisions_member_access on public.decisions for select to authenticated using (org_id is not null and public.is_org_member(org_id));
create policy blockers_member_access on public.blockers for select to authenticated using (org_id is not null and public.is_org_member(org_id));

-- Invites, API tokens, GitHub OAuth state, and installations have no client policies;
-- access is only through the server's service-role client.
