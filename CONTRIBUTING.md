# Contributing to Streamlined CMS Client SDK

## Testing

### Unit Tests

Unit tests use Vitest with JSDOM for DOM simulation.

```bash
# Run all unit tests
npm run test:unit

# Watch mode
npm run test:watch
```

### Browser Tests

Browser tests use Playwright (library only) with Vitest as the test runner. Tests are fully self-contained - they start their own HTTP server and use controlled test fixtures.

#### Running Browser Tests

```bash
# Run all browser tests
npm run test:browser

# Run browser tests in watch mode
npm run test:browser:watch
```

Browser tests automatically:
- Build the SDK (if needed)
- Start an HTTP server on an available port
- Serve test fixtures from `tests/browser/fixtures/`
- Run tests against controlled HTML
- Shut down the server when complete

#### Test Environment

- Self-hosted test server (auto-selects available port)
- Tests run against the staging API: `https://streamlined-cms-api-worker-staging.whi.workers.dev`
- Test fixtures use `data-app-id="test-app"` to isolate from demo data
- Mock authentication is enabled via `data-mock-auth="true"`
- Debug logging is enabled via `data-debug="true"`
- Uses Chromium browser (headless by default)

#### Writing Browser Tests

Browser tests use semantic selectors and user-focused assertions:

```typescript
// Good - semantic, user-focused
const saveButton = page.locator('#streamlined-save-btn');
const isVisible = await saveButton.isVisible();
expect(isVisible).toBe(true);

// Good - using data attributes
const heroTitle = page.locator('[data-editable="hero-title"]');
await heroTitle.click();
```

#### Development

To see the browser during test execution, modify the test file:

```typescript
browser = await chromium.launch({
    headless: false, // Show the browser
});
```

### Running All Tests

```bash
npm test
```

## Code Formatting

This project uses Prettier for code formatting:

- 4-space indent for TypeScript/JavaScript
- 2-space indent for CSS
- Double quotes, semicolons, trailing commas

```bash
# Format all files
npm run format

# Check formatting
npm run format:check
```

## Building

```bash
# Build the SDK
npm run build

# Build and watch for changes
npm run dev
```
