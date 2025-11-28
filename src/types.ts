/**
 * Log level options
 * Internal type uses string values for the severity hierarchy
 */
export type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug';

/**
 * Log level input options (accepts false/null which normalize to 'none')
 */
export type LogLevelInput = LogLevel | false | null;

/**
 * Configuration options for StreamlinedCMS
 */
export interface StreamlinedCMSConfig {
    /**
     * API endpoint URL (e.g., 'https://api.streamlinedcms.com')
     */
    apiUrl: string;

    /**
     * Application ID (required)
     */
    appId: string;

    /**
     * Logging level: 'none' | 'error' | 'warn' | 'info' | 'debug' | false | null
     * Defaults to 'error'. Use false/null or 'none' to disable all logging.
     */
    logLevel?: LogLevelInput;

    /**
     * Mock authentication (for development)
     */
    mockAuth?: {
        enabled: boolean;
        userId?: string;
    };
}

/**
 * Content element data structure
 */
export interface ContentElement {
    appId: string;
    elementId: string;
    content: string;
    updatedAt: string;
    updatedBy?: string;
}

/**
 * API response for saving content
 */
export interface SaveResponse {
    success: boolean;
    element?: ContentElement;
    error?: string;
}
