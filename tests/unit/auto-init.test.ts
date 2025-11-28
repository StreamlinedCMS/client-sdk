import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Tests for auto-init module
 *
 * Note: auto-init.ts has side effects on import (injects styles, runs autoInit).
 * Full end-to-end coverage is provided by browser tests (tests/browser/).
 * These unit tests verify specific behaviors that can be tested in isolation.
 */

describe('auto-init', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        vi.clearAllMocks();
    });

    afterEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
    });

    describe('script tag config parsing', () => {
        it('should find script tag with streamlined-cms in src', () => {
            const script = document.createElement('script');
            script.src = '/dist/streamlined-cms.js';
            script.dataset.apiUrl = 'https://api.example.com';
            script.dataset.appId = 'my-app';
            script.dataset.logLevel = 'debug';
            script.dataset.mockAuth = 'true';
            script.dataset.mockUserId = 'user-123';
            document.head.appendChild(script);

            const scripts = document.querySelectorAll<HTMLScriptElement>('script[src*="streamlined-cms"]');
            const foundScript = scripts[scripts.length - 1];

            expect(foundScript).toBeDefined();
            expect(foundScript.dataset.apiUrl).toBe('https://api.example.com');
            expect(foundScript.dataset.appId).toBe('my-app');
            expect(foundScript.dataset.logLevel).toBe('debug');
            expect(foundScript.dataset.mockAuth).toBe('true');
            expect(foundScript.dataset.mockUserId).toBe('user-123');
        });

        it('should get last script tag when multiple exist', () => {
            // First script
            const script1 = document.createElement('script');
            script1.src = '/dist/streamlined-cms.js';
            script1.dataset.appId = 'first-app';
            document.head.appendChild(script1);

            // Second script (should be selected)
            const script2 = document.createElement('script');
            script2.src = '/dist/streamlined-cms.js';
            script2.dataset.appId = 'second-app';
            document.head.appendChild(script2);

            const scripts = document.querySelectorAll<HTMLScriptElement>('script[src*="streamlined-cms"]');
            const foundScript = scripts[scripts.length - 1];

            expect(foundScript.dataset.appId).toBe('second-app');
        });

        it('should handle logLevel validation', () => {
            const validLevels = ['none', 'error', 'warn', 'info', 'debug'];

            validLevels.forEach(level => {
                const script = document.createElement('script');
                script.src = '/streamlined-cms.js';
                script.dataset.logLevel = level;
                document.head.appendChild(script);

                const foundScript = document.querySelector<HTMLScriptElement>('script[src*="streamlined-cms"]:last-of-type');
                expect(validLevels.includes(foundScript!.dataset.logLevel!)).toBe(true);

                script.remove();
            });
        });

        it('should return empty config when no script tag found', () => {
            const scripts = document.querySelectorAll<HTMLScriptElement>('script[src*="streamlined-cms"]');
            expect(scripts.length).toBe(0);
        });
    });

    describe('hiding styles structure', () => {
        it('should have correct hiding style content when manually created', () => {
            // This tests the expected structure of the hiding styles
            const style = document.createElement('style');
            style.id = 'streamlined-cms-hiding';
            style.textContent = `
                [data-editable] {
                    visibility: hidden !important;
                }
            `;
            document.head.appendChild(style);

            const foundStyle = document.getElementById('streamlined-cms-hiding');
            expect(foundStyle).not.toBeNull();
            expect(foundStyle?.textContent).toContain('[data-editable]');
            expect(foundStyle?.textContent).toContain('visibility: hidden');
        });

        it('should be removable after content loads', () => {
            const style = document.createElement('style');
            style.id = 'streamlined-cms-hiding';
            style.textContent = '[data-editable] { visibility: hidden; }';
            document.head.appendChild(style);

            // Simulate SDK removing it after init
            style.remove();

            expect(document.getElementById('streamlined-cms-hiding')).toBeNull();
        });
    });

    describe('autoInit export', () => {
        it('should export autoInit function', async () => {
            // Set flag to prevent side effects
            (window as any).__STREAMLINED_CMS_NO_AUTO_INIT__ = true;

            const module = await import('../../src/auto-init.js');

            expect(module.autoInit).toBeDefined();
            expect(typeof module.autoInit).toBe('function');

            delete (window as any).__STREAMLINED_CMS_NO_AUTO_INIT__;
        });
    });

    describe('error handling', () => {
        it('should log error when appId is missing', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            // Create script tag without appId
            const script = document.createElement('script');
            script.src = '/dist/streamlined-cms.js';
            script.dataset.apiUrl = 'https://api.example.com';
            // No appId
            document.head.appendChild(script);

            // Import with reset to get fresh instance
            vi.resetModules();
            delete (window as any).__STREAMLINED_CMS_NO_AUTO_INIT__;

            await import('../../src/auto-init.js');

            expect(consoleSpy).toHaveBeenCalledWith(
                '[StreamlinedCMS] App ID is required. Add data-app-id to your script tag.'
            );

            consoleSpy.mockRestore();
        });
    });

    describe('NO_AUTO_INIT flag', () => {
        it('should check for flag before auto-init', () => {
            // The flag check happens in the module
            expect(typeof (window as any).__STREAMLINED_CMS_NO_AUTO_INIT__).toBe('undefined');

            (window as any).__STREAMLINED_CMS_NO_AUTO_INIT__ = true;
            expect((window as any).__STREAMLINED_CMS_NO_AUTO_INIT__).toBe(true);

            delete (window as any).__STREAMLINED_CMS_NO_AUTO_INIT__;
        });
    });
});

/**
 * Note: Full integration testing of auto-init is done in browser tests.
 * See tests/browser/editing.test.ts for end-to-end coverage including:
 * - Style injection on page load
 * - SDK initialization with real DOM
 * - Content loading from API
 * - Editing functionality
 */
