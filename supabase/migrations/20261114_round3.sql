-- BATON Round 3: risk scoring, function roles. Idempotent; the app also runs without it (see docs/ARCHITECTURE.md).
-- Conflicts, audiences, bus-factor modules and version diffs reuse existing jsonb columns and need nothing here.
alter table public.handover_questions add column if not exists risk_score integer;
alter table public.handover_questions add column if not exists risk_reasons jsonb;
alter table public.handover_questions add column if not exists confidence text;
alter table public.handover_questions add column if not exists answer_mode text;
create index if not exists handover_questions_risk_idx on public.handover_questions (handover_id, risk_score desc);

alter table public.org_memberships add column if not exists function_role text;
alter table public.org_memberships drop constraint if exists org_memberships_function_role_check;
alter table public.org_memberships add constraint org_memberships_function_role_check
  check (function_role is null or function_role in ('backend','frontend','infra','data','design','product'));
