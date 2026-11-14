import { createHash, randomUUID } from 'node:crypto';
import { redactData } from './redact.js';

export type MemoryType = 'decision' | 'blocker' | 'context' | 'change';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

export interface MemoryEvent {
  type: MemoryType | 'bootstrap';
  content?: string;
  data?: unknown;
  metadata?: Record<string, unknown>;
}

const PROCESS_SESSION_ID = randomUUID();
const MAX_RESPONSE_BYTES = 1024 * 1024;

function configuration(): { apiUrl: string; apiKey: string; orgId: string; repositoryId: string; sessionId: string } {
  const apiUrl = process.env.BATON_API_URL?.trim();
  const apiKey = process.env.BATON_API_KEY?.trim();
  const orgId = process.env.BATON_ORG_ID?.trim();
  const repositoryId = process.env.BATON_REPOSITORY_ID?.trim();
  const missing = [
    ['BATON_API_URL', apiUrl],
    ['BATON_API_KEY', apiKey],
    ['BATON_ORG_ID', orgId],
    ['BATON_REPOSITORY_ID', repositoryId]
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Missing required Baton configuration: ${missing.join(', ')}`);

  let parsed: URL;
  try {
    parsed = new URL(apiUrl!);
  } catch {
    throw new Error('BATON_API_URL must be an absolute HTTP(S) URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('BATON_API_URL must be an HTTP(S) base URL without credentials, query, or fragment');
  }

  return {
    apiUrl: apiUrl!.replace(/\/+$/, ''),
    apiKey: apiKey!,
    orgId: orgId!,
    repositoryId: repositoryId!,
    sessionId: process.env.BATON_SESSION_ID?.trim() || PROCESS_SESSION_ID
  };
}

function safe<T>(value: T): T {
  return redactData(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record).sort().map((key) => [key, canonicalize(record[key])])
    );
  }
  return value;
}

async function request<T>(path: string, init: RequestInit = {}, asText = false): Promise<ApiResponse<T>> {
  let config: ReturnType<typeof configuration>;
  try {
    config = configuration();
  } catch (error) {
    return { success: false, message: safe(error instanceof Error ? error.message : 'Invalid Baton configuration') };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${config.apiUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        ...init.headers
      }
    });
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_RESPONSE_BYTES) {
            await reader.cancel();
            return { success: false, message: 'Baton backend response exceeded 1 MiB and was discarded.' };
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder().decode(bytes);
    let body: unknown;
    if (asText && response.ok) {
      body = text;
    } else {
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = text.slice(0, 1000);
      }
    }
    if (!response.ok) {
      const detail = typeof body === 'object' && body !== null && 'error' in body
        ? String((body as { error: unknown }).error).slice(0, 500)
        : `HTTP ${response.status}`;
      return { success: false, message: safe(`Baton backend rejected the request (${response.status}): ${detail}`) };
    }
    return { success: true, message: 'Baton backend request succeeded.', data: safe(body) as T };
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'Baton backend request timed out.'
      : 'Baton backend is unreachable; no data was saved.';
    return { success: false, message };
  } finally {
    clearTimeout(timer);
  }
}

export function getRepositoryScope() {
  try {
    const { orgId, repositoryId, sessionId } = configuration();
    return { success: true as const, orgId, repositoryId, sessionId };
  } catch (error) {
    return { success: false as const, message: safe(error instanceof Error ? error.message : 'Invalid Baton configuration') };
  }
}

export async function pushMemory(type: MemoryType | 'bootstrap', payload: unknown): Promise<ApiResponse> {
  let scope: ReturnType<typeof getRepositoryScope>;
  try {
    scope = getRepositoryScope();
  } catch {
    return { success: false, message: 'Baton configuration is invalid.' };
  }
  if (!scope.success) return { success: false, message: scope.message };

  const data = safe(payload);
  const content = typeof data === 'string' ? data : undefined;
  const eventId = createHash('sha256').update(JSON.stringify(canonicalize({
    type,
    org_id: scope.orgId,
    repository_id: scope.repositoryId,
    session_id: scope.sessionId,
    data
  }))).digest('hex');
  const event = {
    type,
    ...(content === undefined ? { data } : { content, data }),
    timestamp: new Date().toISOString(),
    source: 'baton-mcp-server',
    org_id: scope.orgId,
    repository_id: scope.repositoryId,
    session_id: scope.sessionId,
    event_id: eventId
  };
  return request('/api/collector/push', { method: 'POST', body: JSON.stringify(event) });
}

export async function queryContext(query: string): Promise<ApiResponse> {
  let scope = getRepositoryScope();
  if (!scope.success) return { success: false, message: scope.message };
  const params = new URLSearchParams({
    q: String(safe(query)).slice(0, 1000),
    org_id: scope.orgId,
    repository_id: scope.repositoryId
  });
  return request(`/api/collector/search?${params}`, { method: 'GET' });
}

export async function getGithubActivity(): Promise<ApiResponse> {
  const scope = getRepositoryScope();
  if (!scope.success) return { success: false, message: scope.message };
  const params = new URLSearchParams({ repository_id: scope.repositoryId });
  const response = await request<Record<string, unknown>>(`/api/orgs/${encodeURIComponent(scope.orgId)}/state?${params}`, { method: 'GET' });
  if (!response.success) return response;
  const state = response.data && typeof response.data === 'object' ? response.data : {};
  const repositories = Array.isArray(state.repositories) ? state.repositories : [];
  const repository = repositories.find((item) => item && typeof item === 'object' &&
    String((item as Record<string, unknown>).id ?? (item as Record<string, unknown>).repository_id) === scope.repositoryId);
  const sources = Array.isArray(state.sources) ? state.sources : [];
  const scopedSources = sources.filter((source) => source && typeof source === 'object' &&
    String((source as Record<string, unknown>).repository_id ?? (source as Record<string, unknown>).repo_id ?? '') === scope.repositoryId)
    .slice(0, 100);
  return {
    success: true,
    message: 'Repository tracking state retrieved.',
    data: safe({ repository: repository ?? null, activity: scopedSources })
  };
}

export async function getExitInterviews(): Promise<ApiResponse> {
  const scope = getRepositoryScope();
  if (!scope.success) return { success: false, message: scope.message };
  const params = new URLSearchParams({ org_id: scope.orgId, repository_id: scope.repositoryId });
  return request(`/api/mcp/interviews?${params}`, { method: 'GET' });
}

export async function answerExitQuestion(interviewId: string, questionId: string, answer: string): Promise<ApiResponse> {
  const scope = getRepositoryScope();
  if (!scope.success) return { success: false, message: scope.message };
  if (!interviewId.trim() || !questionId.trim()) return { success: false, message: 'Interview and question IDs are required.' };
  return request(`/api/mcp/interviews/${encodeURIComponent(interviewId)}/answers`, {
    method: 'POST',
    body: JSON.stringify({ questionId: questionId.slice(0, 200), answer: String(safe(answer)).slice(0, 10_000) })
  });
}

type InterviewHandover = { id?: string; status?: string; approved_at?: string | null; updated_at?: string | null };

/** Fetches the approved handover packet as Markdown; without an id, picks the newest approved interview. */
export async function exportHandoverMarkdown(handoverId?: string): Promise<ApiResponse<{ handoverId: string; markdown: string }>> {
  const scope = getRepositoryScope();
  if (!scope.success) return { success: false, message: scope.message };
  let id = handoverId?.trim();
  if (!id) {
    const listed = await getExitInterviews();
    if (!listed.success) return { success: false, message: listed.message };
    const approved = ((listed.data as { interviews?: Array<{ handover?: InterviewHandover }> } | undefined)?.interviews ?? [])
      .map(item => item.handover)
      .filter((item): item is InterviewHandover => Boolean(item?.id) && item?.status === 'approved')
      .sort((a, b) => String(b.approved_at ?? b.updated_at ?? '').localeCompare(String(a.approved_at ?? a.updated_at ?? '')));
    id = approved[0]?.id;
    if (!id) {
      return {
        success: false,
        message: 'No approved handover is available yet. Answer the exit-interview questions, generate the packet in the Baton dashboard and have an admin approve it, then export again.'
      };
    }
  }
  const result = await request<string>(`/api/handovers/${encodeURIComponent(id)}/export.md`, { method: 'GET', headers: { Accept: 'text/markdown' } }, true);
  if (!result.success || typeof result.data !== 'string') return { success: false, message: result.message };
  return { success: true, message: 'Handover exported.', data: { handoverId: id, markdown: result.data } };
}

export async function pushCommit(data: { sha: string; message: string; author: string; files?: string[]; diff_summary?: string }): Promise<ApiResponse> {
  const scope = getRepositoryScope();
  if (!scope.success) return { success: false, message: scope.message };
  return request('/api/collector/commit', {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      message: safe(data.message),
      diff_summary: data.diff_summary ? safe(data.diff_summary) : undefined,
      org_id: scope.orgId,
      repository_id: scope.repositoryId
    })
  });
}

export async function pushFiles(data: { path: string; content_hash: string; chunks?: string[]; summary?: string; commit_sha?: string }): Promise<ApiResponse> {
  const scope = getRepositoryScope();
  if (!scope.success) return { success: false, message: scope.message };
  return request('/api/collector/files', {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      summary: data.summary ? safe(data.summary) : undefined,
      org_id: scope.orgId,
      repository_id: scope.repositoryId
    })
  });
}

export async function pushMessages(messages: Array<{ tool: string; sessionId: string; index: number; role: string; content: string; occurred_at?: string }>): Promise<ApiResponse> {
  const scope = getRepositoryScope();
  if (!scope.success) return { success: false, message: scope.message };
  const safeMessages = messages.map(m => ({
    ...m,
    content: safe(m.content)
  }));
  return request('/api/collector/messages', {
    method: 'POST',
    body: JSON.stringify({
      messages: safeMessages,
      org_id: scope.orgId,
      repository_id: scope.repositoryId
    })
  });
}

export async function getCursor(tool: string, sessionId: string): Promise<{ success: boolean; cursor: number; message?: string }> {
  const scope = getRepositoryScope();
  if (!scope.success) return { success: false, cursor: -1, message: scope.message };
  const params = new URLSearchParams({
    org_id: scope.orgId,
    repository_id: scope.repositoryId,
    tool,
    session: sessionId
  });
  const res = await request<{ cursor: number }>(`/api/collector/cursor?${params}`, { method: 'GET' });
  if (!res.success) return { success: false, cursor: -1, message: res.message };
  return { success: true, cursor: res.data?.cursor ?? -1 };
}

export async function getFileContext(path: string): Promise<ApiResponse> {
  const scope = getRepositoryScope();
  if (!scope.success) return { success: false, message: scope.message };
  const params = new URLSearchParams({
    q: path,
    org_id: scope.orgId,
    repository_id: scope.repositoryId
  });
  return request(`/api/collector/search?${params}`, { method: 'GET' });
}