#!/usr/bin/env node

/**
 * Upload SDK build artifacts to R2 bucket for CDN distribution.
 *
 * Usage: node scripts/cdn-upload.js <staging|production>
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { parse as parseToml } from "smol-toml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

const environment = process.argv[2];

if (!["staging", "production"].includes(environment)) {
    console.error("Usage: node scripts/cdn-upload.js <staging|production>");
    process.exit(1);
}

// Read bucket name from cdn package's wrangler config
const wranglerConfigPath = join(
    __dirname,
    "../../cdn",
    environment === "staging" ? "wrangler.staging.toml" : "wrangler.toml",
);

if (!existsSync(wranglerConfigPath)) {
    console.error(`Error: wrangler config not found at ${wranglerConfigPath}`);
    process.exit(1);
}

const wranglerConfig = parseToml(readFileSync(wranglerConfigPath, "utf-8"));
const bucketName = wranglerConfig.r2_buckets?.[0]?.bucket_name;

if (!bucketName) {
    console.error(`Error: R2 bucket not configured in ${wranglerConfigPath}`);
    process.exit(1);
}

const version = packageJson.version;
const collection = "client-sdk";

const files = [
    "streamlined-cms.js",
    "streamlined-cms.js.map",
    "streamlined-cms.min.js",
    "streamlined-cms.min.js.map",
    "streamlined-cms.esm.js",
    "streamlined-cms.esm.js.map",
    "streamlined-cms.esm.min.js",
    "streamlined-cms.esm.min.js.map",
];

// Build first
console.log("Building SDK...\n");
execSync("npm run build", { stdio: "inherit", cwd: join(__dirname, "..") });

// Check if version already exists in R2
const checkPath = `${bucketName}/${collection}/${version}/${files[0]}`;
let versionExists = false;
try {
    execSync(`wrangler r2 object get "${checkPath}" --remote --pipe > /dev/null 2>&1`, {
        stdio: "pipe",
    });
    versionExists = true;
} catch {
    // File doesn't exist
}

// Show what will be uploaded
console.log(`\nUploading SDK v${version} to ${environment}:\n`);
for (const file of files) {
    console.log(`  ${bucketName} -> ${collection}/${version}/${file}`);
}

if (versionExists) {
    console.log(`\n⚠️  Version ${version} already exists and will be overwritten.`);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await new Promise((resolve) => {
    rl.question(`\nProceed? (yes/N): `, resolve);
});
rl.close();
if (answer.toLowerCase() !== "yes") {
    console.log("Aborted.");
    process.exit(0);
}

console.log();

for (const file of files) {
    const localPath = join(__dirname, "..", "dist", file);
    const r2Path = `${bucketName}/${collection}/${version}/${file}`;

    try {
        execSync(`wrangler r2 object put "${r2Path}" --remote --file "${localPath}"`, {
            stdio: "inherit",
        });
    } catch (error) {
        console.error(`\nFailed to upload ${file}`);
        process.exit(1);
    }
}

console.log(`\nUpload complete. SDK v${version} is now in ${bucketName}.`);
console.log(`\nTo make this version live, run:`);
console.log(`  npm run cdn:publish:${environment}`);
