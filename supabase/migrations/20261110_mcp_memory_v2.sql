-- ====================================================================
-- BATON MCP MEMORY V2 MIGRATION (Vector embeddings & transcript ingest)
-- Run this in your Supabase SQL Editor if you already ran the base schema.
-- ====================================================================

create extension if not exists vector;

-- Ensure public.organizations exists
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.organizations add column if not exists created_by uuid references auth.users(id) on delete set null;

-- Ensure public.repositories exists or has all foreign key requirements
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

-- Ensure agent_messages table exists
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

-- Ensure file_summaries table exists
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

-- Ensure all sources columns exist
alter table public.sources add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.sources add column if not exists repository_id uuid references public.repositories(id) on delete set null;
alter table public.sources add column if not exists session_id text;
alter table public.sources add column if not exists event_id text;
alter table public.sources add column if not exists author_id text;
alter table public.sources add column if not exists embedding vector(768);

create index if not exists sources_embedding_idx on public.sources using hnsw (embedding vector_cosine_ops);
create index if not exists file_summaries_embedding_idx on public.file_summaries using hnsw (embedding vector_cosine_ops);

alter table public.agent_messages enable row level security;
alter table public.file_summaries enable row level security;

drop policy if exists agent_messages_member_access on public.agent_messages;
create policy agent_messages_member_access on public.agent_messages
  for all to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

drop policy if exists file_summaries_member_access on public.file_summaries;
create policy file_summaries_member_access on public.file_summaries
  for all to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

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
