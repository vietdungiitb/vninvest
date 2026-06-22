# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login.spec.ts >> Login Flow >> shows error on invalid credentials
- Location: tests\visual\login.spec.ts:17:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[type="text"], input[name="username"], input[type="email"]').first()

```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [ref=e4]:
    - heading "VNInvest" [level=1] [ref=e5]
    - paragraph [ref=e6]: Đăng nhập vào nền tảng SaaS VNInvest
    - generic [ref=e7]:
      - generic [ref=e8]:
        - generic [ref=e9]: Tên đăng nhập hoặc email
        - textbox "Tên đăng nhập hoặc email" [ref=e10]:
          - /placeholder: Nhập tên đăng nhập hoặc email
      - generic [ref=e11]:
        - generic [ref=e12]: Mật khẩu
        - textbox "Mật khẩu" [ref=e13]:
          - /placeholder: ••••••••
      - button "Đăng nhập" [ref=e14]
    - generic [ref=e15]:
      - link "Tạo tài khoản" [ref=e16] [cursor=pointer]:
        - /url: /register
      - link "Quên mật khẩu?" [ref=e17] [cursor=pointer]:
        - /url: /reset-password
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Login Flow', () => {
  4  |   test('displays login form with all required fields', async ({ page }) => {
  5  |     await page.goto('/login', { waitUntil: 'networkidle' });
  6  | 
  7  |     const emailInput = page.locator('input[type="text"], input[name="username"], input[type="email"]').first();
  8  |     await expect(emailInput).toBeVisible();
  9  | 
  10 |     const passwordInput = page.locator('input[type="password"]');
  11 |     await expect(passwordInput).toBeVisible();
  12 | 
  13 |     const submitButton = page.locator('button[type="submit"]');
  14 |     await expect(submitButton).toBeVisible();
  15 |   });
  16 | 
  17 |   test('shows error on invalid credentials', async ({ page }) => {
  18 |     await page.goto('/login', { waitUntil: 'networkidle' });
  19 | 
  20 |     const emailInput = page.locator('input[type="text"], input[name="username"], input[type="email"]').first();
> 21 |     await emailInput.fill('invalid@example.com');
     |                      ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  22 | 
  23 |     const passwordInput = page.locator('input[type="password"]');
  24 |     await passwordInput.fill('wrongpassword');
  25 | 
  26 |     await page.locator('button[type="submit"]').click();
  27 | 
  28 |     await page.waitForTimeout(2000);
  29 |   });
  30 | 
  31 |   test('redirects to dashboard after successful login and stores token', async ({ page }) => {
  32 |     await page.goto('/login', { waitUntil: 'networkidle' });
  33 | 
  34 |     const emailInput = page.locator('input[type="text"], input[name="username"], input[type="email"]').first();
  35 |     await emailInput.fill('testuser@vninvest.vn');
  36 | 
  37 |     const passwordInput = page.locator('input[type="password"]');
  38 |     await passwordInput.fill('TestPass123!');
  39 | 
  40 |     await page.locator('button[type="submit"]').click();
  41 | 
  42 |     await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {});
  43 | 
  44 |     const currentUrl = page.url();
  45 |     if (currentUrl.includes('/dashboard')) {
  46 |       const hasToken = await page.evaluate(() => {
  47 |         const token = localStorage.getItem('auth_access_token') || sessionStorage.getItem('auth_access_token');
  48 |         return !!token;
  49 |       });
  50 |       expect(hasToken).toBeTruthy();
  51 |     }
  52 |   });
  53 | 
  54 |   test('persists session and auto-redirects when token exists', async ({ page }) => {
  55 |     await page.goto('/login', { waitUntil: 'networkidle' });
  56 | 
  57 |     const hasToken = await page.evaluate(() => {
  58 |       return !!(localStorage.getItem('auth_access_token') || sessionStorage.getItem('auth_access_token'));
  59 |     });
  60 | 
  61 |     if (hasToken) {
  62 |       await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {});
  63 |       const currentUrl = page.url();
  64 |       if (currentUrl.includes('/login')) {
  65 |         test.skip(true, 'No stored token to test auto-redirect');
  66 |       }
  67 |     } else {
  68 |       test.skip(true, 'No stored token to test auto-redirect');
  69 |     }
  70 |   });
  71 | });
  72 | 
```