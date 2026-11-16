-- Tighten direct database access to handovers, agent transcripts and file summaries, and accept the
-- 'all' visibility value the API writes. The app reads and writes these tables only through the API's
-- service-role connection, which bypasses RLS; these policies limit what a signed-in user can read
-- with their own token. Run once on existing databases; safe to re-run.

-- Sources: the API stores team-wide records as 'all'.
alter table public.sources drop constraint if exists sources_visibility_check;
alter table public.sources add constraint sources_visibility_check check (visibility in ('team','all','admin','private')) not valid;

-- Handovers: admins, or the two people the handover is between.
drop policy if exists handovers_member_read on public.handovers;
drop policy if exists handovers_participant_read on public.handovers;
create policy handovers_participant_read on public.handovers for select to authenticated using (
  public.is_org_admin(org_id) or leaver_id = auth.uid() or incoming_id = auth.uid()
);

-- Claims: admins; participants only once approved, never admin-only or rejected claims.
drop policy if exists handover_claims_member_access on public.handover_claims;
drop policy if exists handover_claims_participant_read on public.handover_claims;
create policy handover_claims_participant_read on public.handover_claims for select to authenticated using (
  public.is_org_admin(org_id) or (
    visibility <> 'admin' and status <> 'rejected' and exists (
      select 1 from public.handovers h
       where h.id = handover_id and h.status = 'approved' and (h.leaver_id = auth.uid() or h.incoming_id = auth.uid())))
);

-- Questions: admins, the person they are assigned to, and participants for non-admin questions.
drop policy if exists handover_questions_member_access on public.handover_questions;
drop policy if exists handover_questions_participant_read on public.handover_questions;
create policy handover_questions_participant_read on public.handover_questions for select to authenticated using (
  public.is_org_admin(org_id) or assigned_to = auth.uid() or (
    visibility <> 'admin' and exists (
      select 1 from public.handovers h
       where h.id = handover_id and (h.leaver_id = auth.uid() or h.incoming_id = auth.uid())))
);

-- Version snapshots and the audit trail contain admin-only material; non-admins get filtered copies from the API.
drop policy if exists handover_versions_member_read on public.handover_versions;
drop policy if exists handover_versions_admin_read on public.handover_versions;
create policy handover_versions_admin_read on public.handover_versions for select to authenticated using (public.is_org_admin(org_id));
drop policy if exists handover_events_member_read on public.handover_events;
drop policy if exists handover_events_admin_read on public.handover_events;
create policy handover_events_admin_read on public.handover_events for select to authenticated using (public.is_org_admin(org_id));

-- Agent transcripts: read your own (admins read all); no direct writes or deletes.
drop policy if exists agent_messages_member_access on public.agent_messages;
drop policy if exists agent_messages_owner_read on public.agent_messages;
create policy agent_messages_owner_read on public.agent_messages for select to authenticated using (
  public.is_org_admin(org_id) or (public.is_org_member(org_id) and author_id = auth.uid()::text)
);

-- File summaries: members read; no direct writes or deletes.
drop policy if exists file_summaries_member_access on public.file_summaries;
drop policy if exists file_summaries_member_read on public.file_summaries;
create policy file_summaries_member_read on public.file_summaries for select to authenticated using (public.is_org_member(org_id));
