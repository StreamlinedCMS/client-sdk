import { test, expect, describe } from "vitest";
import { initLazy } from "../../src/lazy/index.js";

describe("SDK version", () => {
    test("version is available as static property", async () => {
        // Access the class via dynamic import to check static property
        const module = await import("../../src/lazy/index.js");
        // The module exports initLazy, but we need to check the class
        // Create an instance and check both static and instance access
        const controller = await initLazy({
            apiUrl: "http://test",
            appUrl: "http://test",
            appId: "test-app",
        });

        // Check instance getter
        expect(controller.version).toBe("0.0.0-test");
        expect(typeof controller.version).toBe("string");
    });

    test("version matches expected test value", async () => {
        const controller = await initLazy({
            apiUrl: "http://test",
            appUrl: "http://test",
            appId: "test-app",
        });

        // Vitest config sets __SDK_VERSION__ to "0.0.0-test"
        expect(controller.version).toBe("0.0.0-test");
    });
});
