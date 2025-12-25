/**
 * Shared helpers for browser tests.
 * These utilities are used across multiple test files.
 */

import { initLazy } from "../../../src/lazy/index.js";
import { initTestHelpers } from "./test-helpers.js";
import type { EditorController } from "../../../src/lazy/index.js";

// Declare global variables injected by vitest config
declare const __SDK_API_URL__: string;
declare const __SDK_APP_URL__: string;

let controller: EditorController | null = null;

/**
 * Get the current controller instance
 */
export function getController(): EditorController | null {
    return controller;
}

/**
 * Run the loader script to fetch content and populate DOM.
 * Returns a promise that resolves when the loader completes.
 */
export async function runLoader(): Promise<void> {
    const TIMEOUT_MS = 5000;

    // Remove any existing loader script
    document.querySelectorAll('script[data-app-id="test-app"]').forEach((el) => el.remove());

    // Create promise that resolves when loader dispatches complete event
    const loaderComplete = new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(`runLoader: Timed out after ${TIMEOUT_MS}ms waiting for loader-complete event`));
        }, TIMEOUT_MS);

        document.addEventListener(
            "streamlined-cms:loader-complete",
            () => {
                clearTimeout(timeoutId);
                resolve();
            },
            { once: true }
        );
    });

    // Inject the loader script
    const script = document.createElement("script");
    script.src = "/dist/streamlined-cms.min.js";
    script.dataset.appId = "test-app";
    // Use full URL instead of relative (avoids Vite proxy issues with dynamic ports)
    script.dataset.apiUrl = __SDK_API_URL__;
    script.dataset.skipEsm = "true";

    document.head.appendChild(script);

    // Wait for loader to complete
    await loaderComplete;
}

/**
 * Initialize the SDK.
 * Each test file gets a fresh browser context, so no DOM reset is needed.
 */
export async function initializeSDK(): Promise<EditorController> {
    // Run the loader to fetch content and populate DOM
    await runLoader();

    // Initialize the SDK
    controller = await initLazy({
        apiUrl: __SDK_API_URL__,
        appUrl: __SDK_APP_URL__,
        appId: "test-app",
        logLevel: "none",
        mockAuth: {
            enabled: true,
            userId: "test-user",
        },
    });

    // Wait for SDK to be fully initialized
    await waitForSelector(".streamlined-editable");

    return controller;
}

/**
 * Wait for a selector to appear in the DOM
 */
export async function waitForSelector(selector: string, timeout = 3000): Promise<Element> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const el = document.querySelector(selector);
        if (el) return el;
        await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`Timeout waiting for selector: ${selector}`);
}

/**
 * Wait for a condition to be true
 */
export async function waitForCondition(fn: () => boolean, timeout = 3000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (fn()) return;
        await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("Timeout waiting for condition");
}

/**
 * Click a toolbar button by text content.
 * Waits for Lit to re-render before searching for the button.
 */
export async function clickToolbarButton(text: string): Promise<boolean> {
    // Wait for Lit to process any pending updates
    await new Promise((r) => setTimeout(r, 100));

    const toolbar = document.querySelector("scms-toolbar");
    const buttons = toolbar?.shadowRoot?.querySelectorAll("button") || [];
    for (const btn of buttons) {
        if (btn.textContent?.trim().includes(text)) {
            btn.click();
            return true;
        }
    }
    return false;
}

/**
 * Setup function to be called in beforeAll
 */
export function setupTestHelpers(): void {
    initTestHelpers(__SDK_API_URL__.replace("/v1", ""));
}
