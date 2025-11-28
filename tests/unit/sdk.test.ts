import { describe, it, expect, beforeEach, vi } from "vitest";
import { StreamlinedCMS } from "../../src/sdk";

describe("StreamlinedCMS", () => {
    let config: any;

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = "";

        // Reset config
        config = {
            apiUrl: "http://localhost:8787",
            appId: "test-app",
            logLevel: "none",
            mockAuth: {
                enabled: true,
                userId: "test-user",
            },
        };
    });

    describe("constructor", () => {
        it("should initialize with provided config", () => {
            const cms = new StreamlinedCMS(config);
            expect(cms).toBeDefined();
        });

        it("should enable mock auth when configured", () => {
            const cms = new StreamlinedCMS(config);
            expect(cms).toBeDefined();
            // Auth state is private, but we can test it indirectly through init
        });
    });

    describe("init", () => {
        it("should scan for editable elements", async () => {
            document.body.innerHTML = `
        <div data-editable="element1">Content 1</div>
        <div data-editable="element2">Content 2</div>
      `;

            const cms = new StreamlinedCMS(config);

            // Mock fetch to prevent API calls
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 404,
            });

            await cms.init();

            // Check that editable class was added
            const elements = document.querySelectorAll(".streamlined-editable");
            expect(elements.length).toBe(2);
        });

        it("should inject edit styles", async () => {
            document.body.innerHTML = '<div data-editable="test">Test</div>';

            const cms = new StreamlinedCMS(config);

            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 404,
            });

            await cms.init();

            const styleElement = document.getElementById("streamlined-cms-styles");
            expect(styleElement).toBeDefined();
            expect(styleElement?.tagName).toBe("STYLE");
        });

        it("should load content from API if available", async () => {
            document.body.innerHTML = '<div data-editable="test">Original</div>';

            const cms = new StreamlinedCMS(config);

            // Mock successful API response
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({
                    appId: "test-app",
                    count: 1,
                    elements: [
                        {
                            appId: "test-app",
                            elementId: "test",
                            content: "Updated from API",
                            updatedAt: new Date().toISOString(),
                        },
                    ],
                }),
            });

            await cms.init();

            const element = document.querySelector('[data-editable="test"]');
            expect(element?.innerHTML).toBe("Updated from API");
        });

        it("should handle API errors gracefully", async () => {
            document.body.innerHTML = '<div data-editable="test">Original</div>';

            const cms = new StreamlinedCMS(config);

            // Mock API error
            global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

            // Should not throw
            await expect(cms.init()).resolves.not.toThrow();

            // Original content should remain
            const element = document.querySelector('[data-editable="test"]');
            expect(element?.innerHTML).toBe("Original");
        });
    });

    describe("editing", () => {
        it("should make element contenteditable when clicked", async () => {
            document.body.innerHTML = '<div data-editable="test">Test content</div>';

            const cms = new StreamlinedCMS(config);

            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 404,
            });

            await cms.init();

            const element = document.querySelector('[data-editable="test"]') as HTMLElement;
            element.click();

            expect(element.getAttribute("contenteditable")).toBe("true");
            expect(element.classList.contains("streamlined-editing")).toBe(true);
        });

        it("should show save button when editing", async () => {
            document.body.innerHTML = '<div data-editable="test">Test content</div>';

            const cms = new StreamlinedCMS(config);

            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 404,
            });

            await cms.init();

            const element = document.querySelector('[data-editable="test"]') as HTMLElement;
            element.click();

            const saveButton = document.getElementById("streamlined-save-btn");
            expect(saveButton).toBeDefined();
            expect(saveButton?.textContent).toBe("Save Changes");
        });
    });

    describe("log level", () => {
        it("should return configured log level", () => {
            const cms = new StreamlinedCMS({ ...config, logLevel: "debug" });
            expect(cms.getLogLevel()).toBe("debug");
        });

        it("should default to error log level", () => {
            const { logLevel, ...configWithoutLogLevel } = config;
            const cms = new StreamlinedCMS(configWithoutLogLevel);
            expect(cms.getLogLevel()).toBe("error");
        });

        it("should normalize false to none", () => {
            const cms = new StreamlinedCMS({ ...config, logLevel: false });
            expect(cms.getLogLevel()).toBe("none");
        });

        it("should normalize null to none", () => {
            const cms = new StreamlinedCMS({ ...config, logLevel: null });
            expect(cms.getLogLevel()).toBe("none");
        });

        it("should support all log levels", () => {
            const levels = ["none", "error", "warn", "info", "debug"] as const;

            levels.forEach((level) => {
                const cms = new StreamlinedCMS({ ...config, logLevel: level });
                expect(cms.getLogLevel()).toBe(level);
            });
        });

        it("should log debug messages when debug level set", async () => {
            const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            document.body.innerHTML = '<div data-editable="test">Test</div>';

            const cms = new StreamlinedCMS({ ...config, logLevel: "debug" });

            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 404,
            });

            await cms.init();

            expect(consoleSpy).toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining("[StreamlinedCMS]"),
                expect.anything()
            );

            consoleSpy.mockRestore();
        });

        it("should not log when log level is none", async () => {
            const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
            const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
            const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

            document.body.innerHTML = '<div data-editable="test">Test</div>';

            const cms = new StreamlinedCMS({ ...config, logLevel: "none" });

            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 404,
            });

            await cms.init();

            // With logLevel 'none', no logs should appear
            const streamlinedLogs = consoleLogSpy.mock.calls.filter(
                (call) => call[0]?.toString().includes("[StreamlinedCMS]")
            );
            expect(streamlinedLogs.length).toBe(0);

            consoleLogSpy.mockRestore();
            consoleWarnSpy.mockRestore();
            consoleErrorSpy.mockRestore();
        });
    });

    describe("saving", () => {
        it("should send PUT request when saving", async () => {
            document.body.innerHTML = '<div data-editable="test">Updated content</div>';

            const cms = new StreamlinedCMS(config);

            let fetchCalls = 0;
            global.fetch = vi.fn((url: string, options?: any) => {
                fetchCalls++;

                // First call is loading content
                if (fetchCalls === 1) {
                    return Promise.resolve({
                        ok: false,
                        status: 404,
                    });
                }

                // Second call is saving
                expect(url).toBe("http://localhost:8787/apps/test-app/content/test");
                expect(options?.method).toBe("PUT");

                const body = JSON.parse(options?.body);
                expect(body.content).toBe("Updated content");
                expect(body.updatedBy).toBe("test-user");

                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        appId: "test-app",
                        elementId: "test",
                        content: "Updated content",
                        updatedAt: new Date().toISOString(),
                        updatedBy: "test-user",
                    }),
                });
            });

            await cms.init();

            const element = document.querySelector('[data-editable="test"]') as HTMLElement;
            element.click();

            const saveButton = document.getElementById("streamlined-save-btn") as HTMLButtonElement;
            saveButton.click();

            // Wait for async save
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(fetchCalls).toBe(2);
        });
    });
});
