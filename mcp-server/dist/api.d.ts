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
export declare function getRepositoryScope(): {
    success: true;
    orgId: string;
    repositoryId: string;
    sessionId: string;
    message?: undefined;
} | {
    success: false;
    message: string;
    orgId?: undefined;
    repositoryId?: undefined;
    sessionId?: undefined;
};
export declare function pushMemory(type: MemoryType | 'bootstrap', payload: unknown): Promise<ApiResponse>;
export declare function queryContext(query: string): Promise<ApiResponse>;
export declare function getGithubActivity(): Promise<ApiResponse>;
export declare function getExitInterviews(): Promise<ApiResponse>;
export declare function answerExitQuestion(interviewId: string, questionId: string, answer: string): Promise<ApiResponse>;
/** Fetches the approved handover packet as Markdown; without an id, picks the newest approved interview. */
export declare function exportHandoverMarkdown(handoverId?: string): Promise<ApiResponse<{
    handoverId: string;
    markdown: string;
}>>;
export declare function pushCommit(data: {
    sha: string;
    message: string;
    author: string;
    files?: string[];
    diff_summary?: string;
}): Promise<ApiResponse>;
export declare function pushFiles(data: {
    path: string;
    content_hash: string;
    chunks?: string[];
    summary?: string;
    commit_sha?: string;
}): Promise<ApiResponse>;
export declare function pushMessages(messages: Array<{
    tool: string;
    sessionId: string;
    index: number;
    role: string;
    content: string;
    occurred_at?: string;
}>): Promise<ApiResponse>;
export declare function getCursor(tool: string, sessionId: string): Promise<{
    success: boolean;
    cursor: number;
    message?: string;
}>;
export declare function getFileContext(path: string): Promise<ApiResponse>;
