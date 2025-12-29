import { defineConfig, loadEnv } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

const useHttps = process.env.HTTPS === "true";

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "VITE_");

    return {
        root: "demo",
        publicDir: false,
        server: {
            port: useHttps ? 4443 : 4080,
            open: false,
            allowedHosts: true,
        },
        resolve: {
            alias: {
                "@streamlined-cms/client-sdk": "../dist/streamlined-cms.esm.js",
            },
        },
        plugins: [
            ...(useHttps ? [basicSsl()] : []),
            {
                name: "html-env-replace",
                transformIndexHtml(html) {
                    return html
                        .replace(/__VITE_API_URL__/g, env.VITE_API_URL || "")
                        .replace(/__VITE_APP_URL__/g, env.VITE_APP_URL || "")
                        .replace(/__VITE_APP_ID__/g, env.VITE_APP_ID || "")
                        .replace(/__VITE_LOG_LEVEL__/g, env.VITE_LOG_LEVEL || "debug");
                },
            },
        ],
    };
});
