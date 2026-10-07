import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/e2e', outputDir: 'test-results/browser', timeout: 180000, expect: { timeout: 15000 }, use: { viewport: { width: 1280, height: 900 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' }, workers: 1, reporter: 'list' });
