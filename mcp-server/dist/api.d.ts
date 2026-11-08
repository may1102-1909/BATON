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
 * Dispatch captured and redacted memory to the Next.js backend.
 */
export declare function pushMemory(type: 'decision' | 'blocker', rawPayload: Record<string, unknown>): Promise<ApiResponse>;
/**
 * Query the Baton backend for relevant memory and architectural context.
 */
export declare function queryContext(query: string): Promise<ApiResponse>;
