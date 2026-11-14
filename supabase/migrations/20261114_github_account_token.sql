-- The GitHub link stores the user token encrypted (v1:iv:tag:ciphertext) in this column.
-- Safe to run more than once.
alter table public.github_accounts add column if not exists access_token_encrypted text;
