import { createServer, Server } from "http";
import { readFile } from "fs/promises";
import { join, extname } from "path";
import getPort from "get-port";

/**
 * Simple HTTP server for browser tests
 * Serves test fixtures and the built SDK
 */
export class TestServer {
    private server: Server | null = null;
    private port: number | null = null;

    async start(): Promise<void> {
        // Find any available port
        this.port = await getPort();

        return new Promise((resolve, reject) => {
            this.server = createServer(async (req, res) => {
                try {
                    let filePath: string;

                    // Serve dist files
                    if (req.url?.startsWith("/dist/")) {
                        filePath = join(process.cwd(), req.url);
                    }
                    // Serve test fixtures
                    else if (req.url === "/" || req.url === "/index.html") {
                        filePath = join(process.cwd(), "tests/browser/fixtures/test-page.html");
                    } else {
                        res.writeHead(404);
                        res.end("Not found");
                        return;
                    }

                    // Read and serve the file
                    const content = await readFile(filePath);
                    const ext = extname(filePath);

                    // Set content type
                    const contentTypes: Record<string, string> = {
                        ".html": "text/html",
                        ".js": "application/javascript",
                        ".css": "text/css",
                        ".json": "application/json",
                        ".map": "application/json",
                    };

                    const contentType = contentTypes[ext] || "text/plain";
                    res.writeHead(200, { "Content-Type": contentType });
                    res.end(content);
                } catch (error) {
                    res.writeHead(404);
                    res.end("Not found");
                }
            });

            this.server.listen(this.port, () => {
                resolve();
            });

            this.server.on("error", reject);
        });
    }

    async stop(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.server) {
                this.server.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    getUrl(): string {
        if (!this.port) {
            throw new Error("Server not started - call start() first");
        }
        return `http://localhost:${this.port}`;
    }

    getPort(): number {
        if (!this.port) {
            throw new Error("Server not started - call start() first");
        }
        return this.port;
    }
}
