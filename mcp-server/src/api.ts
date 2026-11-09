import { randomUUID } from 'node:crypto';
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

async function request<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
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
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = text.slice(0, 1000);
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
  const event = {
    type,
    ...(content === undefined ? { data, payload: data } : { content, data, payload: data }),
    timestamp: new Date().toISOString(),
    source: 'baton-mcp-server',
    org_id: scope.orgId,
    repository_id: scope.repositoryId,
    session_id: scope.sessionId,
    event_id: randomUUID()
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
