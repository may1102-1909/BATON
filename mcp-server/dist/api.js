import { redactData } from './redact.js';
/**
 * Get the configured Baton Backend API base URL.
 */
function getApiUrl() {
    const url = process.env.BATON_API_URL || 'http://localhost:3000';
    return url.replace(/\/+$/, '');
}
/**
 * Dispatch captured and redacted memory to the Next.js backend.
 */
export async function pushMemory(type, rawPayload) {
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
        const headers = {
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
        const json = (await response.json());
        return {
            success: true,
            message: `Memory of type "${type}" successfully stored in Baton backend.`,
            data: json
        };
    }
    catch (error) {
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
export async function queryContext(query) {
    const sanitizedQuery = redactData(query);
    const endpoint = `${getApiUrl()}/api/collector/search?q=${encodeURIComponent(sanitizedQuery)}`;
    try {
        const headers = {
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
        const json = (await response.json());
        return {
            success: true,
            message: 'Context retrieved successfully from Baton memory.',
            data: json
        };
    }
    catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            message: `Baton backend unreachable at ${endpoint} (${errMsg}). No remote context retrieved.`
        };
    }
}
