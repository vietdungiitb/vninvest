/**
 * Visual Regression Baseline Capture Script
 * Run after: npm run build && npm run preview
 * Usage: node scripts/capture-baseline.mjs
 * 
 * Captures baseline screenshots for critical pages:
 * - Dashboard
 * - StockDetailPage (VCB)
 * - AlertCenterPage
 * - AICommandCenterPage
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:4173';
const BASELINE_DIR = path.resolve('./visual-baselines');
const VIEWPORTS = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 667 },
];

const PAGES = [
  { path: '/', name: 'dashboard' },
  { path: '/stocks/VCB', name: 'stock-detail-vcb' },
  { path: '/alert-center', name: 'alert-center' },
  { path: '/ai-command-center', name: 'ai-command-center' },
];

async function captureBaselines() {
  console.log('🚀 Starting visual baseline capture...');
  console.log(`📁 Baseline directory: ${BASELINE_DIR}`);
  console.log(`🌐 Base URL: ${BASE_URL}`);

  // Ensure baseline directory exists
  if (!fs.existsSync(BASELINE_DIR)) {
    fs.mkdirSync(BASELINE_DIR, { recursive: true });
  }

  const browser = await chromium.launch();
  
  try {
    for (const viewport of VIEWPORTS) {
      console.log(`\n📱 Capturing ${viewport.name} (${viewport.width}x${viewport.height})...`);
      
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
      });

      const page = await context.newPage();

      for (const pageConfig of PAGES) {
        const url = `${BASE_URL}${pageConfig.path}`;
        const filename = `${pageConfig.name}-${viewport.name}.png`;
        const filepath = path.join(BASELINE_DIR, filename);

        console.log(`  📸 ${pageConfig.name}...`);
        
        try {
          await page.goto(url, { 
            waitUntil: 'networkidle',
            timeout: 30000 
          });
          
          // Wait for any animations to settle
          await page.waitForTimeout(1000);
          
          // Hide dynamic elements that cause flaky screenshots
          await page.addStyleTag({
            content: `
              .animate-spin, .pulse-live, [class*="spinning"] {
                animation: none !important;
              }
              .core-alert-live-dot {
                animation: none !important;
              }
            `
          });

          await page.screenshot({ 
            path: filepath, 
            fullPage: true,
            animations: 'disabled'
          });
          
          console.log(`    ✅ Saved: ${filename}`);
        } catch (error) {
          console.error(`    ❌ Failed: ${error.message}`);
        }
      }

      await context.close();
    }

    console.log('\n✨ Baseline capture complete!');
    console.log(`📁 Baselines saved to: ${BASELINE_DIR}`);
    console.log('\n📋 Next steps:');
    console.log('   1. Commit baseline images to git');
    console.log('   2. Configure Playwright test to compare against these baselines');
    console.log('   3. Set threshold: maxDiffPixels: 0.1%');

  } finally {
    await browser.close();
  }
}

captureBaselines().catch(console.error);
