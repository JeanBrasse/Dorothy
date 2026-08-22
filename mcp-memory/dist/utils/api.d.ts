/**
 * API utilities for communicating with dorothy API server
 */
export declare function getCallerIdentity(): {
    agentId: string;
    projectPath: string;
};
export declare function apiRequest(endpoint: string, method?: "GET" | "POST" | "DELETE", body?: Record<string, unknown>, timeoutMsOverride?: number): Promise<unknown>;
