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
