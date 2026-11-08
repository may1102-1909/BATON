import { redactData } from './redact.js';

export interface MemoryPayload {
  type: 'decision' | 'blocker';
  payload: Record<string, unknown>;
  timestamp: string;
  source?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

/**
 * Get the configured Baton Backend API base URL.
 */
function getApiUrl(): string {
  const url = process.env.BATON_API_URL || 'http://localhost:3000';
  return url.replace(/\/+$/, '');
}

/**
 * Dispatch captured and redacted memory to the Next.js backend.
 */
export async function pushMemory(
  type: 'decision' | 'blocker',
  rawPayload: Record<string, unknown>
): Promise<ApiResponse> {
  // 1. Redact all sensitive credentials, tokens, and high-entropy secrets client-side
  const sanitizedPayload = redactData(rawPayload);

  const memoryEvent = {
    type,
    data: sanitizedPayload,
    payload: sanitizedPayload,
    timestamp: new Date().toISOString(),
    source: 'baton-mcp-server'
  };

  const endpoint = `${getApiUrl()}/api/collector/push`;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    const authToken = process.env.BATON_PROJECT_KEY || process.env.BATON_API_KEY;
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(memoryEvent)
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        message: `Backend push returned HTTP ${response.status}: ${errText}`
      };
    }

    const json = (await response.json()) as Record<string, unknown>;
    return {
      success: true,
      message: `Memory of type "${type}" successfully stored in Baton backend.`,
      data: json
    };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    // If backend is not currently running, provide helpful fallback info rather than throwing unhandled rejection
    return {
      success: false,
      message: `Baton backend unreachable at ${endpoint} (${errMsg}). Memory was sanitized client-side. Make sure Next.js backend is running.`,
      data: { sanitizedEvent: memoryEvent }
    };
  }
}

/**
 * Query the Baton backend for relevant memory and architectural context.
 */
export async function queryContext(query: string): Promise<ApiResponse> {
  const sanitizedQuery = redactData(query);
  const endpoint = `${getApiUrl()}/api/collector/search?q=${encodeURIComponent(sanitizedQuery)}`;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (process.env.BATON_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.BATON_API_KEY}`;
    }

    const response = await fetch(endpoint, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        message: `Backend search returned HTTP ${response.status}: ${errText}`
      };
    }

    const json = (await response.json()) as Record<string, unknown>;
    return {
      success: true,
      message: 'Context retrieved successfully from Baton memory.',
      data: json
    };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Baton backend unreachable at ${endpoint} (${errMsg}). No remote context retrieved.`
    };
  }
}

