#!/usr/bin/env node
export declare function syncCommit(ref?: string): Promise<{
    commitSha: string;
    filesSynced: number;
}>;
export declare function syncTranscripts(): Promise<{
    messagesSynced: number;
}>;
export declare function initProject(): Promise<void>;
