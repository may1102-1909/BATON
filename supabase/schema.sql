-- ====================================================================
-- BATON COMPLETE SELF-HEALING DATABASE SETUP & MIGRATION SCHEMA
-- Fully idempotent: works on fresh databases AND seamlessly upgrades
-- existing databases regardless of what legacy columns/tables exist.
-- ====================================================================

-- 1. Required PostgreSQL Extensions
create extension if not exists pgcrypto;
create extension if not exists vector;

-- 2. Organizations & Team Memberships
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.organizations add column if not exists created_by uuid references auth.users(id) on delete set null;

insert into public.organizations (name)
select 'Mumbai_wale Hackathon Org'
where not exists (select 1 from public.organizations where name = 'Mumbai_wale Hackathon Org');

create table if not exists public.org_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  email text,
  role text not null default 'member' check (role in ('admin','member','team')),
  github_login text,
  disabled_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.org_memberships add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.org_memberships add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.org_memberships add column if not exists email text;
alter table public.org_memberships add column if not exists role text not null default 'member';
alter table public.org_memberships add column if not exists github_login text;
alter table public.org_memberships add column if not exists disabled_at timestamptz;

-- 3. Repositories
create table if not exists public.repositories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  installation_id text,
  github_repo_id bigint,
  full_name text not null default '',
  default_branch text,
  private boolean not null default true,
  synced_at timestamptz,
  last_synced_at timestamptz,
  github_repository_id bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.repositories add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.repositories add column if not exists installation_id text;
alter table public.repositories add column if not exists github_repo_id bigint;
alter table public.repositories add column if not exists full_name text not null default '';
alter table public.repositories add column if not exists default_branch text;
alter table public.repositories add column if not exists private boolean not null default true;
alter table public.repositories add column if not exists synced_at timestamptz;
alter table public.repositories add column if not exists last_synced_at timestamptz;
alter table public.repositories add column if not exists github_repository_id bigint;
alter table public.repositories add column if not exists metadata jsonb not null default '{}'::jsonb;

-- 4. Sources (Agent Decisions, Blockers, Commits & PR Evidence)
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  author_id text,
  author text not null default 'Agent',
  author_login text,
  content text not null default '',
  type text not null default 'evidence',
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
alter table public.sources add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.sources add column if not exists author_id text;
alter table public.sources drop constraint if exists sources_author_id_fkey;
do $$ begin
  alter table public.sources alter column author_id type text using author_id::text;
exception when others then null;
end $$;
alter table public.sources add column if not exists author text not null default 'Agent';
alter table public.sources add column if not exists author_login text;
alter table public.sources add column if not exists content text not null default '';
alter table public.sources add column if not exists type text not null default 'evidence';
alter table public.sources add column if not exists external_id text;
alter table public.sources add column if not exists url text;
alter table public.sources add column if not exists sha text;
alter table public.sources add column if not exists committer jsonb;
alter table public.sources add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.sources add column if not exists repository_id uuid references public.repositories(id) on delete set null;
alter table public.sources add column if not exists session_id text;
alter table public.sources add column if not exists event_id text;
alter table public.sources add column if not exists visibility text not null default 'team';
alter table public.sources add column if not exists created_at timestamptz not null default now();
alter table public.sources add column if not exists timestamp timestamptz not null default now();
alter table public.sources add column if not exists embedding vector(768);

-- 5. Tasks & Threaded Comments
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  title text not null default '',
  description text not null default '',
  assignee_id uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open','in_progress','done','cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tasks add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.tasks add column if not exists title text not null default '';
alter table public.tasks add column if not exists description text not null default '';
alter table public.tasks add column if not exists assignee_id uuid references auth.users(id) on delete set null;
alter table public.tasks add column if not exists due_at timestamptz;
alter table public.tasks add column if not exists status text not null default 'open';
alter table public.tasks add column if not exists created_by uuid references auth.users(id) on delete set null;

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  parent_id uuid references public.task_comments(id) on delete cascade,
  content text not null default '',
  created_at timestamptz not null default now()
);
alter table public.task_comments add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.task_comments add column if not exists task_id uuid references public.tasks(id) on delete cascade;
alter table public.task_comments add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table public.task_comments add column if not exists parent_id uuid references public.task_comments(id) on delete cascade;
alter table public.task_comments add column if not exists content text not null default '';

-- 6. Organization Invites & API Tokens
create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  token_hash text not null unique,
  email text,
  role text not null default 'member' check (role in ('member','team')),
  created_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);
alter table public.organization_invites add column if not exists org_id uuid references public.organizations(id) on delete cascade;

create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null default '',
  token_hash text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.api_tokens add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.api_tokens add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 7. Handovers, Claims, Questions, Versions & Audit Events
create table if not exists public.handovers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
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
alter table public.handovers add column if not exists org_id uuid references public.organizations(id) on delete cascade;

create table if not exists public.handover_claims (
  id uuid primary key default gen_random_uuid(),
  handover_id uuid references public.handovers(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  claim text,
  text text not null default '',
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
alter table public.handover_claims add column if not exists org_id uuid references public.organizations(id) on delete cascade;

create table if not exists public.handover_questions (
  id uuid primary key default gen_random_uuid(),
  handover_id uuid references public.handovers(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  asked_by uuid references auth.users(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  question_text text not null default '',
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
alter table public.handover_questions add column if not exists org_id uuid references public.organizations(id) on delete cascade;

create table if not exists public.handover_versions (
  id uuid primary key default gen_random_uuid(),
  handover_id uuid references public.handovers(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  version_number integer not null default 1,
  status text not null default 'draft',
  snapshot jsonb not null default '{}'::jsonb,
  source_ids jsonb not null default '[]'::jsonb,
  source_fingerprints jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.handover_versions add column if not exists org_id uuid references public.organizations(id) on delete cascade;

create table if not exists public.handover_events (
  id uuid primary key default gen_random_uuid(),
  handover_id uuid references public.handovers(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.handover_events add column if not exists org_id uuid references public.organizations(id) on delete cascade;

-- 8. GitHub App OAuth & Webhook Tables
create table if not exists public.github_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  github_user_id text not null default '',
  github_login text not null default '',
  access_token text not null default '',
  token_type text not null default 'bearer',
  scope text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.github_accounts add column if not exists org_id uuid references public.organizations(id) on delete cascade;

create table if not exists public.github_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  state_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now()
);
alter table public.github_states add column if not exists org_id uuid references public.organizations(id) on delete cascade;

create table if not exists public.github_deliveries (
  id uuid primary key default gen_random_uuid(),
  delivery_id text not null unique,
  event text not null default '',
  repository_id uuid references public.repositories(id) on delete set null,
  processed_at timestamptz not null default now()
);

create table if not exists public.github_link_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  state_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now()
);
alter table public.github_link_states add column if not exists org_id uuid references public.organizations(id) on delete cascade;

create table if not exists public.github_installations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  installation_id text not null default '',
  account_login text,
  account_type text,
  connected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.github_installations add column if not exists org_id uuid references public.organizations(id) on delete cascade;

-- 9. Decisions & Blockers Tables (Legacy Upgrade & Self-Healing)
create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  decision text not null default '',
  reason text not null default '',
  alternatives text[] not null default '{}',
  files_affected text[] not null default '{}',
  status text not null default 'Verified',
  citation text not null default 'Agent Session',
  created_at timestamptz not null default now()
);
alter table public.decisions add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.decisions add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.decisions add column if not exists decision text not null default '';
alter table public.decisions add column if not exists reason text not null default '';
alter table public.decisions add column if not exists alternatives text[] not null default '{}';
alter table public.decisions add column if not exists files_affected text[] not null default '{}';
alter table public.decisions add column if not exists status text not null default 'Verified';
alter table public.decisions add column if not exists citation text not null default 'Agent Session';

create table if not exists public.blockers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  problem text not null default '',
  status text not null default 'active' check (status in ('active','investigating','blocked','workaround_applied','resolved')),
  workaround_notes text not null default '',
  citation text not null default 'Agent Session',
  created_at timestamptz not null default now()
);
alter table public.blockers add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.blockers add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.blockers add column if not exists problem text not null default '';
alter table public.blockers add column if not exists status text not null default 'active';
alter table public.blockers add column if not exists workaround_notes text not null default '';
alter table public.blockers add column if not exists citation text not null default 'Agent Session';

-- 10. Vector Memory & Transcripts Tables
create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  repository_id uuid references public.repositories(id) on delete set null,
  author_id text not null default '',
  tool text not null default 'agent',
  session_id text not null default '',
  message_index integer not null default 0,
  role text not null default 'user',
  content text not null default '',
  occurred_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.agent_messages add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.agent_messages add column if not exists repository_id uuid references public.repositories(id) on delete set null;

create table if not exists public.file_summaries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  repository_id uuid references public.repositories(id) on delete cascade,
  path text not null default '',
  content_hash text not null default '',
  summary text not null default '',
  commit_sha text,
  embedding vector(768),
  updated_at timestamptz not null default now()
);
alter table public.file_summaries add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.file_summaries add column if not exists repository_id uuid references public.repositories(id) on delete cascade;
alter table public.file_summaries add column if not exists embedding vector(768);

-- 11. Copy organization_id to org_id if existing tables use the alternate naming
do $$
declare
  tbl text;
begin
  for tbl in select table_name from information_schema.tables where table_schema = 'public' loop
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = tbl and column_name = 'organization_id')
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = tbl and column_name = 'org_id') then
      execute format('update public.%I set org_id = organization_id where org_id is null and organization_id is not null', tbl);
    end if;
  end loop;
end $$;

-- 12. Link any legacy records with null org_id to the default organization
do $$
declare
  default_org_id uuid;
begin
  select id into default_org_id from public.organizations where name = 'Mumbai_wale Hackathon Org' limit 1;
  if default_org_id is not null then
    update public.sources set org_id = default_org_id where org_id is null;
    update public.decisions set org_id = default_org_id where org_id is null;
    update public.blockers set org_id = default_org_id where org_id is null;
  end if;
end $$;

-- 13. Create Unique & Performance Indexes
create unique index if not exists org_memberships_dedupe on public.org_memberships(org_id, user_id) where org_id is not null and user_id is not null;
create unique index if not exists repositories_dedupe on public.repositories(org_id, full_name) where org_id is not null and full_name is not null;
create unique index if not exists sources_event_dedupe on public.sources(org_id, author_id, session_id, event_id) where event_id is not null;
create unique index if not exists sources_external_dedupe on public.sources(org_id, repository_id, external_id) where external_id is not null;
create index if not exists sources_org_created_idx on public.sources(org_id, created_at desc);
create index if not exists sources_embedding_idx on public.sources using hnsw (embedding vector_cosine_ops);
create unique index if not exists file_summaries_dedupe on public.file_summaries(org_id, repository_id, path) where org_id is not null and repository_id is not null;
create index if not exists file_summaries_embedding_idx on public.file_summaries using hnsw (embedding vector_cosine_ops);

-- 14. Security Definer Helper Functions
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

-- 15. Enable Row Level Security (RLS) on all user-facing tables
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
alter table public.agent_messages enable row level security;
alter table public.file_summaries enable row level security;

-- 16. Drop any existing policies idempotently before recreation
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
drop policy if exists agent_messages_member_access on public.agent_messages;
drop policy if exists file_summaries_member_access on public.file_summaries;

-- 17. Create RLS Policies
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

create policy decisions_member_access on public.decisions for all to authenticated using (org_id is not null and public.is_org_member(org_id)) with check (org_id is not null and public.is_org_member(org_id));
create policy blockers_member_access on public.blockers for all to authenticated using (org_id is not null and public.is_org_member(org_id)) with check (org_id is not null and public.is_org_member(org_id));

create policy agent_messages_member_access on public.agent_messages for all to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy file_summaries_member_access on public.file_summaries for all to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- 18. Stored Procedure for Hybrid Semantic Recall (pgvector)
create or replace function public.match_memory(
  query_embedding vector(768), p_org uuid, p_repo uuid, match_count int default 8
) returns table (kind text, id uuid, content text, path text, similarity float)
language sql stable as $$
  (select 'source'::text, s.id, s.content, null::text,
          1 - (s.embedding <=> query_embedding)
     from public.sources s
    where s.org_id = p_org and (p_repo is null or s.repository_id = p_repo)
      and s.embedding is not null
    order by s.embedding <=> query_embedding limit match_count)
  union all
  (select 'file'::text, f.id, f.summary, f.path,
          1 - (f.embedding <=> query_embedding)
     from public.file_summaries f
    where f.org_id = p_org and (p_repo is null or f.repository_id = p_repo)
      and f.embedding is not null
    order by f.embedding <=> query_embedding limit match_count)
  order by 5 desc limit match_count;
$$;

-- 19. Realtime Publication Setup
do $$
begin
  alter publication supabase_realtime add table public.sources;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.decisions;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.blockers;
exception when others then null;
end $$;
