-- Migration: MCP Memory v2 (Vector embeddings, Agent Transcripts, File Summaries)
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

create extension if not exists vector;

-- Normalised conversation turns pulled from local agent logs (redacted before upload)
create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  repository_id uuid references public.repositories(id) on delete set null,
  author_id text not null,
  tool text not null,                 -- claude-code | codex | cursor | antigravity
  session_id text not null,
  message_index integer not null,
  role text not null,                 -- user | assistant
  content text not null,              -- already redacted
  occurred_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, author_id, tool, session_id, message_index)
);

-- Per-file / per-module understanding, refreshed only when content hash changes
create table if not exists public.file_summaries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  repository_id uuid references public.repositories(id) on delete cascade,
  path text not null,
  content_hash text not null,
  summary text not null,
  commit_sha text,
  updated_at timestamptz not null default now(),
  unique (org_id, repository_id, path)
);

-- Embeddings (768-dim for Gemini text-embedding-004)
alter table public.sources        add column if not exists embedding vector(768);
alter table public.file_summaries add column if not exists embedding vector(768);

create index if not exists sources_embedding_idx
  on public.sources using hnsw (embedding vector_cosine_ops);
create index if not exists file_summaries_embedding_idx
  on public.file_summaries using hnsw (embedding vector_cosine_ops);

-- Row-level security: members only see rows of their org
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

-- Stored procedure for hybrid semantic recall
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
