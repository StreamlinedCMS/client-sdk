import { test, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { chromium, Browser, Page } from "playwright";
import { TestServer } from "./server.js";

/**
 * Browser tests for inline editing functionality
 * Tests run against a self-hosted test server with controlled HTML fixtures
 */

let browser: Browser;
let page: Page;
let server: TestServer;
let testUrl: string;

beforeAll(async () => {
    // Start test server
    server = new TestServer(3001);
    await server.start();
    testUrl = server.getUrl();

    // Launch browser once for all tests
    browser = await chromium.launch({
        headless: true, // Set to false to see the browser during development
    });
});

afterAll(async () => {
    await browser.close();
    await server.stop();
});

beforeEach(async () => {
    // Create a new page for each test
    page = await browser.newPage();
});

afterEach(async () => {
    await page.close();
});

test("test page loads successfully", async () => {
    await page.goto(testUrl);

    // Check that the page title is correct
    const title = await page.title();
    expect(title).toBe("Streamlined CMS - Test Page");

    // Wait for SDK to initialize and remove hiding styles
    await page.waitForSelector(".streamlined-editable");

    // Verify test elements are visible
    const testTitle = page.locator('[data-editable="test-title"]');
    const isVisible = await testTitle.isVisible();
    expect(isVisible).toBe(true);
});

test("editable elements have visual indicators on hover", async () => {
    await page.goto(testUrl);

    // Wait for SDK to initialize
    await page.waitForSelector(".streamlined-editable");

    const testTitle = page.locator('[data-editable="test-title"]');

    // Hover over element
    await testTitle.hover();

    // Check that the element has the editable class
    const className = await testTitle.getAttribute("class");
    expect(className).toContain("streamlined-editable");
});

test("user can click to edit content", async () => {
    await page.goto(testUrl);

    // Wait for SDK to initialize
    await page.waitForSelector(".streamlined-editable");

    const testTitle = page.locator('[data-editable="test-title"]');

    // Click to start editing
    await testTitle.click();

    // Verify element is now editable
    const isEditable = await testTitle.getAttribute("contenteditable");
    expect(isEditable).toBe("true");

    // Verify editing class is applied
    const className = await testTitle.getAttribute("class");
    expect(className).toContain("streamlined-editing");

    // Verify save button appears
    const saveButton = page.locator("#streamlined-save-btn");
    const isSaveButtonVisible = await saveButton.isVisible();
    expect(isSaveButtonVisible).toBe(true);

    const buttonText = await saveButton.textContent();
    expect(buttonText).toBe("Save Changes");
});

test("user can edit and save content", async () => {
    await page.goto(testUrl);

    // Wait for SDK to initialize
    await page.waitForSelector(".streamlined-editable");

    const testTitle = page.locator('[data-editable="test-title"]');

    // Click to start editing
    await testTitle.click();

    // Edit the content
    const newContent = "Test Edit - Browser Test";
    await testTitle.fill(newContent);

    // Click save
    const saveButton = page.locator("#streamlined-save-btn");
    await saveButton.click();

    // Wait for save to complete
    await page.waitForSelector('#streamlined-save-btn:has-text("Saved!")');

    // Wait for editing to stop
    await page.waitForTimeout(1500); // Wait for the 1 second timeout + buffer

    // Verify content persists after reload
    await page.reload();
    await page.waitForSelector(".streamlined-editable");

    const reloadedTitle = page.locator('[data-editable="test-title"]');
    const reloadedContent = await reloadedTitle.textContent();
    expect(reloadedContent).toContain(newContent);
});

test("SDK initializes without errors", async () => {
    // Listen for console errors
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
        if (msg.type() === "error") {
            consoleErrors.push(msg.text());
        }
    });

    await page.goto(testUrl);

    // Wait for SDK to initialize
    await page.waitForSelector(".streamlined-editable");

    // Verify no console errors during initialization
    // (logLevel='none' should suppress warnings about missing content)
    expect(consoleErrors.length).toBe(0);
});

test("content loads from API on page load", async () => {
    await page.goto(testUrl);

    // Wait for SDK to initialize
    await page.waitForSelector(".streamlined-editable");

    // Intercept API calls to verify content loading
    const responses: string[] = [];
    page.on("response", (response) => {
        if (response.url().includes("/apps/test-app/content")) {
            responses.push(response.url());
        }
    });

    // Reload to trigger content load
    await page.reload();
    await page.waitForSelector(".streamlined-editable");

    // Verify API was called
    expect(responses.length).toBeGreaterThan(0);
});
