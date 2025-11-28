/**
 * Streamlined CMS Client SDK
 *
 * Lightweight library for inline website editing
 */

export { StreamlinedCMS } from "./sdk.js";
export type { StreamlinedCMSConfig, ContentElement, LogLevel, LogLevelInput } from "./types.js";

// Auto-initialize when loaded via script tag
import "./auto-init.js";
