import { defineConfig, devices } from '@playwright/test';

const authFile = 'tests/visual/.auth/user.json';

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: authFile },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], storageState: authFile },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], storageState: authFile },
      dependencies: ['setup'],
    },
    // Mobile viewports
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'], storageState: authFile },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'], storageState: authFile },
      dependencies: ['setup'],
    },
    // W3-5 / S1: mobile ergonomics (WCAG 2.5.5 target size + no h-scroll).
    // Deliberately ISOLATED from the auth `setup` project:
    //  - no `dependencies`   => the real-login setup never runs here, so this
    //    project works against a bare `vite preview` with no backend.
    //  - empty `storageState` => no leftover session from `tests/visual/.auth`.
    //  - `testMatch` is MANDATORY: without it the default testMatch picks up all
    //    18 `*.spec.ts` in this dir, every one of which needs auth, and the run
    //    goes red for reasons unrelated to the AC.
    {
      name: 'mobile-ergonomics',
      testMatch: /mobile-ergonomics\.spec\.ts/,
      use: {
        browserName: 'chromium',
        viewport: { width: 393, height: 851 },
        hasTouch: true,
        storageState: { cookies: [], origins: [] },
      },
    },
  ],

  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  // Visual regression settings
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100, // ~0.1% for 1920x1080
      threshold: 0.2,
    },
  },
});
