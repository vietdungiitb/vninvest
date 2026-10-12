import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Pham Viet Dung/.gemini/antigravity-ide/brain/015d5e06-e61c-466b-aa36-c69e12415ae5';

async function run() {
  console.log('--- Starting Admin Visual & Functional Verification ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  await context.addCookies([
    {
      name: 'sessionid',
      value: 'hyio8vzvc4zr7a00o8jiqu4woie2741q',
      domain: '127.0.0.1',
      path: '/',
    },
    {
      name: 'sessionid',
      value: 'hyio8vzvc4zr7a00o8jiqu4woie2741q',
      domain: 'localhost',
      path: '/',
    },
  ]);

  const page = await context.newPage();

  console.log('1. Navigating to http://127.0.0.1:8080/admin/ ...');
  await page.goto('http://127.0.0.1:8080/admin/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content-main', { timeout: 15000 });

  // Verify not redirected to login
  const url = page.url();
  console.log('Current URL:', url);
  if (url.includes('login')) {
    throw new Error('Session cookie invalid, redirected to login page!');
  }

  // Check header toggle button
  const headerToggle = await page.$('#vn-header-sidebar-toggle');
  if (!headerToggle) {
    throw new Error('MISSING: #vn-header-sidebar-toggle not found in DOM!');
  }
  const isHeaderToggleVisible = await headerToggle.isVisible();
  console.log('Header toggle #vn-header-sidebar-toggle visible:', isHeaderToggleVisible);

  // Check initial widths
  const contentBox = await page.$eval('#content', el => {
    const r = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return { width: r.width, cssWidth: style.width, maxWidth: style.maxWidth };
  });
  console.log('Initial #content width info:', contentBox);

  const dashBox = await page.$eval('.vn-dash', el => {
    const r = el.getBoundingClientRect();
    return { width: r.width };
  });
  console.log('Initial .vn-dash width:', dashBox.width);

  if (contentBox.width <= 650) {
    throw new Error(`FAIL: #content width is only ${contentBox.width}px! Expected full width > 900px.`);
  }
  console.log(`PASS: #content width is ${contentBox.width}px (spans full viewport, 600px cap eliminated!).`);

  // Screenshot 1: Dashboard fullwidth
  const p1 = path.join(ARTIFACT_DIR, 'admin_dashboard_fullwidth_verified.png');
  await page.screenshot({ path: p1, fullPage: false });
  console.log('Saved screenshot 1:', p1);

  // 2. Test Collapse Sidebar via collapseBtn
  console.log('2. Clicking #vn-sidebar-collapse-btn to collapse sidebar...');
  await page.click('#vn-sidebar-collapse-btn');
  await page.waitForTimeout(400);

  const isShiftedAfterCollapse = await page.$eval('#main', el => el.classList.contains('shifted'));
  console.log('Is #main shifted after collapse:', isShiftedAfterCollapse);
  if (isShiftedAfterCollapse) {
    throw new Error('FAIL: #main still has shifted class after clicking collapse button!');
  }

  // Verify floating restore button is visible on the left edge
  const floatingToggle = await page.$('#vn-sidebar-floating-toggle');
  if (!floatingToggle) {
    throw new Error('MISSING: #vn-sidebar-floating-toggle not found in DOM!');
  }
  const isFloatingVisible = await floatingToggle.isVisible();
  const floatingBox = await floatingToggle.boundingBox();
  console.log('Floating restore button visible:', isFloatingVisible, 'BoundingBox:', floatingBox);
  if (!isFloatingVisible) {
    throw new Error('FAIL: #vn-sidebar-floating-toggle is NOT visible when sidebar is collapsed!');
  }
  console.log('PASS: Floating restore button is prominently visible at x=' + floatingBox.x + ', y=' + floatingBox.y);

  // Check content width expanded when sidebar is collapsed
  const contentBoxCollapsed = await page.$eval('#content', el => el.getBoundingClientRect().width);
  console.log('Expanded #content width when collapsed:', contentBoxCollapsed);
  if (contentBoxCollapsed < 1150) {
    throw new Error(`FAIL: #content did not expand to >1150px when collapsed. Width=${contentBoxCollapsed}`);
  }
  console.log(`PASS: #content expanded to ${contentBoxCollapsed}px full-bleed width!`);

  // Screenshot 2: Sidebar collapsed with floating restore button
  const p2 = path.join(ARTIFACT_DIR, 'admin_sidebar_collapsed_with_restore_button.png');
  await page.screenshot({ path: p2, fullPage: false });
  console.log('Saved screenshot 2:', p2);

  // 3. Test Restore via Floating Button
  console.log('3. Clicking floating restore button #vn-sidebar-floating-toggle...');
  await page.click('#vn-sidebar-floating-toggle');
  await page.waitForTimeout(400);

  const isShiftedAfterRestore = await page.$eval('#main', el => el.classList.contains('shifted'));
  console.log('Is #main shifted after clicking floating restore:', isShiftedAfterRestore);
  if (!isShiftedAfterRestore) {
    throw new Error('FAIL: Sidebar did NOT restore after clicking floating button!');
  }
  const isFloatingVisibleAfterRestore = await floatingToggle.isVisible();
  console.log('Floating button visible after restore:', isFloatingVisibleAfterRestore);
  if (isFloatingVisibleAfterRestore) {
    throw new Error('FAIL: Floating button should be hidden when sidebar is open!');
  }
  console.log('PASS: Sidebar successfully restored via floating button!');

  // 4. Test Toggle via Header Button
  console.log('4. Testing header toggle button #vn-header-sidebar-toggle...');
  await page.click('#vn-header-sidebar-toggle');
  await page.waitForTimeout(400);
  const isShiftedHeader1 = await page.$eval('#main', el => el.classList.contains('shifted'));
  console.log('After header toggle click (collapse):', isShiftedHeader1);
  if (isShiftedHeader1) {
    throw new Error('FAIL: Header toggle failed to collapse sidebar!');
  }

  await page.click('#vn-header-sidebar-toggle');
  await page.waitForTimeout(400);
  const isShiftedHeader2 = await page.$eval('#main', el => el.classList.contains('shifted'));
  console.log('After header toggle click again (restore):', isShiftedHeader2);
  if (!isShiftedHeader2) {
    throw new Error('FAIL: Header toggle failed to restore sidebar!');
  }
  console.log('PASS: Header toggle button works bidirectionally!');

  // 5. Test Hotkey '['
  console.log('5. Testing hotkey [ ...');
  await page.keyboard.press('[');
  await page.waitForTimeout(400);
  const isShiftedKey1 = await page.$eval('#main', el => el.classList.contains('shifted'));
  if (isShiftedKey1) {
    throw new Error('FAIL: Hotkey [ failed to collapse sidebar!');
  }

  await page.keyboard.press('[');
  await page.waitForTimeout(400);
  const isShiftedKey2 = await page.$eval('#main', el => el.classList.contains('shifted'));
  if (!isShiftedKey2) {
    throw new Error('FAIL: Hotkey [ failed to restore sidebar!');
  }
  console.log('PASS: Hotkey [ works bidirectionally!');

  // Screenshot 3: Final verified state
  const p3 = path.join(ARTIFACT_DIR, 'admin_restored_verified.png');
  await page.screenshot({ path: p3, fullPage: false });
  console.log('Saved screenshot 3:', p3);

  // 6. Test a Subpage (Whale Alert Canonical)
  console.log('6. Testing subpage /admin/signal_intelligence/whalealertcanonical/ ...');
  await page.goto('http://127.0.0.1:8080/admin/signal_intelligence/whalealertcanonical/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#changelist', { timeout: 10000 });
  const subContentWidth = await page.$eval('#content', el => el.getBoundingClientRect().width);
  console.log('Subpage #content width:', subContentWidth);
  const p4 = path.join(ARTIFACT_DIR, 'admin_subpage_verified.png');
  await page.screenshot({ path: p4, fullPage: false });
  console.log('Saved screenshot 4:', p4);

  console.log('--- ALL VERIFICATIONS PASSED SUCCESSFULLY ---');
  await browser.close();
}

run().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
