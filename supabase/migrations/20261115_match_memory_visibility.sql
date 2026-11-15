-- Enforce source visibility and audience inside match_memory. Run once on existing databases; safe to re-run.
-- Non-admins never receive admin-only, other people's private, or other-function evidence.
-- File summaries carry no visibility; their path-based audience is applied by the API.
drop function if exists public.match_memory(vector, uuid, uuid, int);
create or replace function public.match_memory(
  query_embedding vector(768), p_org uuid, p_repo uuid, match_count int default 8,
  p_user text default null, p_role text default null, p_function_role text default null
) returns table (kind text, id uuid, content text, path text, similarity float)
language sql stable as $$
  (select 'source'::text, s.id, s.content, null::text,
          1 - (s.embedding <=> query_embedding)
     from public.sources s
    where s.org_id = p_org and (p_repo is null or s.repository_id = p_repo)
      and s.embedding is not null
      and (p_role = 'admin' or (
            coalesce(s.visibility, 'all') <> 'admin'
        and (coalesce(s.visibility, 'all') <> 'private' or s.author_id = p_user)
        and (p_function_role is null
          or jsonb_typeof(s.metadata->'audience') is distinct from 'array'
          or s.metadata->'audience' ? 'all'
          or s.metadata->'audience' ? p_function_role)))
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
