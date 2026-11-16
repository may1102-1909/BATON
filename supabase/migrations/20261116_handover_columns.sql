-- Brings handover tables created by an earlier version of Baton up to the shape the API uses
-- (for example a handovers table with leaver_name/incoming_name instead of leaver_id/incoming_id).
-- Additive only: creates missing tables and columns and relaxes NOT NULL on legacy columns the API
-- no longer writes. Nothing is dropped or renamed. Safe to re-run. Run before 20261116_rls_hardening.sql.

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
alter table public.handovers add column if not exists leaver_id uuid references auth.users(id) on delete set null;
alter table public.handovers add column if not exists incoming_id uuid references auth.users(id) on delete set null;
alter table public.handovers add column if not exists status text not null default 'draft';
alter table public.handovers add column if not exists version integer not null default 0;
alter table public.handovers add column if not exists approved_version integer;
alter table public.handovers add column if not exists generation_mode text;
alter table public.handovers add column if not exists summary text;
alter table public.handovers add column if not exists generated_content jsonb not null default '{}'::jsonb;
alter table public.handovers add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.handovers add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.handovers add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table public.handovers add column if not exists approved_at timestamptz;
alter table public.handovers add column if not exists acknowledged_at timestamptz;
alter table public.handovers add column if not exists acknowledged_by uuid references auth.users(id) on delete set null;
alter table public.handovers add column if not exists created_at timestamptz not null default now();
alter table public.handovers add column if not exists updated_at timestamptz not null default now();
alter table public.handovers add column if not exists generation_started_at timestamptz;
alter table public.handovers enable row level security;

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
alter table public.handover_claims add column if not exists handover_id uuid references public.handovers(id) on delete cascade;
alter table public.handover_claims add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.handover_claims add column if not exists claim text;
alter table public.handover_claims add column if not exists text text not null default '';
alter table public.handover_claims add column if not exists section text;
alter table public.handover_claims add column if not exists evidence jsonb not null default '[]'::jsonb;
alter table public.handover_claims add column if not exists source_ids jsonb not null default '[]'::jsonb;
alter table public.handover_claims add column if not exists confidence text;
alter table public.handover_claims add column if not exists generated_by text;
alter table public.handover_claims add column if not exists status text not null default 'unreviewed';
alter table public.handover_claims add column if not exists visibility text not null default 'team';
alter table public.handover_claims add column if not exists review_text text;
alter table public.handover_claims add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.handover_claims add column if not exists reviewed_at timestamptz;
alter table public.handover_claims add column if not exists updated_at timestamptz not null default now();
alter table public.handover_claims add column if not exists created_at timestamptz not null default now();
alter table public.handover_claims enable row level security;

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
alter table public.handover_questions add column if not exists handover_id uuid references public.handovers(id) on delete cascade;
alter table public.handover_questions add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.handover_questions add column if not exists asked_by uuid references auth.users(id) on delete set null;
alter table public.handover_questions add column if not exists assigned_to uuid references auth.users(id) on delete set null;
alter table public.handover_questions add column if not exists question_text text not null default '';
alter table public.handover_questions add column if not exists answer text;
alter table public.handover_questions add column if not exists answered_by uuid references auth.users(id) on delete set null;
alter table public.handover_questions add column if not exists answered_at timestamptz;
alter table public.handover_questions add column if not exists source_ids jsonb not null default '[]'::jsonb;
alter table public.handover_questions add column if not exists risk text;
alter table public.handover_questions add column if not exists visibility text not null default 'team';
alter table public.handover_questions add column if not exists status text not null default 'open';
alter table public.handover_questions add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.handover_questions add column if not exists created_at timestamptz not null default now();
alter table public.handover_questions add column if not exists risk_score integer;
alter table public.handover_questions add column if not exists risk_reasons jsonb;
alter table public.handover_questions add column if not exists confidence text;
alter table public.handover_questions add column if not exists answer_mode text;
alter table public.handover_questions enable row level security;

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
alter table public.handover_versions add column if not exists handover_id uuid references public.handovers(id) on delete cascade;
alter table public.handover_versions add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.handover_versions add column if not exists version_number integer not null default 1;
alter table public.handover_versions add column if not exists status text not null default 'draft';
alter table public.handover_versions add column if not exists snapshot jsonb not null default '{}'::jsonb;
alter table public.handover_versions add column if not exists source_ids jsonb not null default '[]'::jsonb;
alter table public.handover_versions add column if not exists source_fingerprints jsonb not null default '{}'::jsonb;
alter table public.handover_versions add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.handover_versions add column if not exists created_at timestamptz not null default now();
alter table public.handover_versions enable row level security;

create table if not exists public.handover_events (
  id uuid primary key default gen_random_uuid(),
  handover_id uuid references public.handovers(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.handover_events add column if not exists handover_id uuid references public.handovers(id) on delete cascade;
alter table public.handover_events add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.handover_events add column if not exists actor_id uuid references auth.users(id) on delete set null;
alter table public.handover_events add column if not exists event_type text not null default '';
alter table public.handover_events add column if not exists details jsonb not null default '{}'::jsonb;
alter table public.handover_events add column if not exists created_at timestamptz not null default now();
alter table public.handover_events enable row level security;

-- Legacy columns (e.g. leaver_name) must not block inserts that do not set them.
do $$
declare r record;
begin
  for r in select c.table_name, c.column_name from information_schema.columns c
            where c.table_schema = 'public' and c.is_nullable = 'NO' and c.column_default is null and (
              (c.table_name = 'handovers' and c.column_name <> all (array['id','org_id','leaver_id','incoming_id','status','version','approved_version','generation_mode','summary','generated_content','metadata','created_by','approved_by','approved_at','acknowledged_at','acknowledged_by','created_at','updated_at','generation_started_at'])) or
              (c.table_name = 'handover_claims' and c.column_name <> all (array['id','handover_id','org_id','claim','text','section','evidence','source_ids','confidence','generated_by','status','visibility','review_text','reviewed_by','reviewed_at','updated_at','created_at'])) or
              (c.table_name = 'handover_questions' and c.column_name <> all (array['id','handover_id','org_id','asked_by','assigned_to','question_text','answer','answered_by','answered_at','source_ids','risk','visibility','status','created_by','created_at','risk_score','risk_reasons','confidence','answer_mode'])) or
              (c.table_name = 'handover_versions' and c.column_name <> all (array['id','handover_id','org_id','version_number','status','snapshot','source_ids','source_fingerprints','created_by','created_at'])) or
              (c.table_name = 'handover_events' and c.column_name <> all (array['id','handover_id','org_id','actor_id','event_type','details','created_at'])))
  loop
    execute format('alter table public.%I alter column %I drop not null', r.table_name, r.column_name);
    raise notice 'relaxed NOT NULL on %.%', r.table_name, r.column_name;
  end loop;
end $$;
