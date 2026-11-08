-- BATON Continuity Database Schema (Supabase PostgreSQL)
-- Run this in your Supabase Project SQL Editor to create tables for decisions and blockers.

-- 1. Organizations Table
create table if not exists public.organizations (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

insert into public.organizations (name)
values ('Mumbai_wale Hackathon Org')
on conflict (name) do nothing;

-- 2. Sources Table (Baton Collector Dispatched Data)
create table if not exists public.sources (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations(id) on delete set null,
  author text not null default 'Antigravity Agent',
  content text not null,
  type text not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS & Realtime on sources
alter table public.sources enable row level security;

create policy "Allow read access to authenticated users on sources"
  on public.sources for select
  using (true);

create policy "Allow insert access on sources"
  on public.sources for insert
  with check (true);

alter publication supabase_realtime add table public.sources;

-- 2. Decisions Table
create table if not exists public.decisions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  decision text not null,
  reason text not null,
  alternatives text[] default '{}',
  files_affected text[] default '{}',
  status text default 'Verified',
  citation text default 'Agent Session',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Blockers Table
create table if not exists public.blockers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  problem text not null,
  status text default 'active' check (status in ('active', 'investigating', 'blocked', 'workaround_applied', 'resolved')),
  workaround_notes text default '',
  citation text default 'Agent Session',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Enable Row Level Security (RLS)
alter table public.decisions enable row level security;
alter table public.blockers enable row level security;

-- 4. Policies: Allow authenticated users to view & insert their project memories
create policy "Allow read access to authenticated users"
  on public.decisions for select
  to authenticated
  using (true);

create policy "Allow insert access to authenticated users"
  on public.decisions for insert
  to authenticated
  with check (true);

create policy "Allow read access to authenticated users on blockers"
  on public.blockers for select
  to authenticated
  using (true);

create policy "Allow insert access to authenticated users on blockers"
  on public.blockers for insert
  to authenticated
  with check (true);

-- 5. Enable Realtime Replication
alter publication supabase_realtime add table public.decisions;
alter publication supabase_realtime add table public.blockers;
