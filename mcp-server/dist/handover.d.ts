/** Resolves a repository-relative Markdown path and refuses anything that escapes the repository or touches .git. */
export declare function resolveHandoverPath(root: string, outputPath: string | undefined, handoverId: string): Promise<string>;
/** Downloads the approved handover packet and writes it into the repository as a Markdown file. */
export declare function exportHandoverFile(handoverId?: string, outputPath?: string): Promise<{
    success: boolean;
    message: string;
    data?: undefined;
} | {
    success: boolean;
    message: string;
    data: {
        handoverId: string;
        path: string;
        bytes: number;
        markdown?: undefined;
    };
} | {
    success: boolean;
    message: string;
    data: {
        handoverId: string;
        markdown: string;
        path?: undefined;
        bytes?: undefined;
    };
}>;
