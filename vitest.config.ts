import { defineConfig } from "vitest/config";

export default defineConfig({
    // Build-time constants must be defined to avoid reference errors.
    // Tests override these via data-api-url/data-app-url HTML attributes,
    // so these values are never actually used at runtime.
    define: {
        __SDK_API_URL__: JSON.stringify("http://unused-in-tests"),
        __SDK_APP_URL__: JSON.stringify("http://unused-in-tests"),
    },
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./tests/setup.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text"],
            include: ["src/**/*.ts"],
            exclude: [
                "src/types.ts", // Type definitions only
                "src/index.ts", // Re-exports only
            ],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 80,
                statements: 80,
            },
        },
    },
});
