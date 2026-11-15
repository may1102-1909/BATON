-- Cross-instance lock for handover generation: two serverless instances can no longer
-- regenerate the same handover at once. Safe to re-run.
alter table public.handovers add column if not exists generation_started_at timestamptz;
