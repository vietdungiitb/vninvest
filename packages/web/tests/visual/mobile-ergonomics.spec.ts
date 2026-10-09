import { test, expect, type Page } from '@playwright/test';

/**
 * S1 (W3-5) — mobile ergonomics on PUBLIC routes, no auth required.
 *
 * Routes: `/login` and `/register`, declared OUTSIDE `ProtectedRoute` at
 * `packages/web/src/main.tsx:130-131`. Everything else hangs off
 * `ProtectedRoute` (`main.tsx:137`) which redirects to `/login` when no
 * token, so measuring them would silently re-measure the login page.
 *
 * Two assertions:
 *  (i)  no horizontal scroll — `scrollWidth <= innerWidth`.
 *       NOTE: this already passes today; it is a REGRESSION GUARD, not progress.
 *  (ii) primary interactive controls have a hit area >= 44x44 CSS px
 *       (WCAG 2.5.5 Target Size). This is the one that legitimately fails
 *       before the `@media (pointer: coarse)` block in `src/index.css`.
 *
 * Only touch pointers are asserted: the project sets `hasTouch: true`, so the
 * coarse-pointer media query is active. Desktop is untouched by design.
 */

/** Controls a finger must hit. Deliberately excludes links in long prose. */
const PRIMARY_SELECTOR = [
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[role="button"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  'form a[href], nav a[href]',
].join(', ');

const MIN_TARGET_PX = 44;

const PUBLIC_ROUTES = ['/login', '/register'] as const;

/** One control each route is guaranteed to have once React has mounted. */
const READY_SELECTOR = 'form input:not(.invisible-honeypot), form button';

/**
 * Pages are lazy chunks (`resolvePageComponent`) so the DOM is empty until
 * React mounts. Without this wait the measurement sees 0 controls and
 * asserts a false PASS.
 */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await page.locator(READY_SELECTOR).first().waitFor({ state: 'visible', timeout: 15000 });
}

type Offender = {
  route: string;
  tag: string;
  name: string;
  width: number;
  height: number;
};

async function collectUndersized(page: Page, route: string): Promise<Offender[]> {
  return page.evaluate(
    ({ selector, min }) => {
      const nodes = Array.from(document.querySelectorAll(selector));
      const out: Array<{ tag: string; name: string; width: number; height: number }> = [];
      for (const el of nodes) {
        const html = el as HTMLElement;
        // Honeypot: 1x1, aria-hidden, pointer-events:none, tabIndex=-1.
        // It is not a user-operable target — measuring it is meaningless.
        if (html.classList.contains('invisible-honeypot')) continue;
        // Skip anything not actually rendered or not user-operable.
        if (html.offsetParent === null && getComputedStyle(html).position !== 'fixed') continue;
        if (html.getAttribute('aria-hidden') === 'true') continue;
        if (html.hasAttribute('disabled')) continue;
        const style = getComputedStyle(html);
        if (style.visibility === 'hidden' || style.display === 'none') continue;
        if (style.pointerEvents === 'none') continue;

        const rect = html.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;

        const label =
          html.getAttribute('aria-label') ||
          html.getAttribute('placeholder') ||
          (html.textContent || '').trim().slice(0, 40) ||
          html.getAttribute('name') ||
          html.getAttribute('type') ||
          '';
        if (rect.width + 0.5 < min || rect.height + 0.5 < min) {
          out.push({
            tag: html.tagName.toLowerCase(),
            name: label,
            width: Math.round(rect.width * 10) / 10,
            height: Math.round(rect.height * 10) / 10,
          });
        }
      }
      return out;
    },
    { selector: PRIMARY_SELECTOR, min: MIN_TARGET_PX },
  ).then((raw) => raw.map((o) => ({ route, ...o })));
}

test.describe('mobile ergonomics (public routes)', () => {
  test('(i) no horizontal scroll at 393px wide', async ({ page }) => {
    const failures: string[] = [];

    for (const route of PUBLIC_ROUTES) {
      await open(page, route);

      const measured = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));

      // eslint-disable-next-line no-console
      console.log(
        `[h-scroll] ${route} scrollWidth=${measured.scrollWidth} innerWidth=${measured.innerWidth}`,
      );

      if (measured.scrollWidth > measured.innerWidth) {
        failures.push(
          `${route}: scrollWidth ${measured.scrollWidth} > innerWidth ${measured.innerWidth}`,
        );
      }
    }

    expect(failures, `horizontal overflow:\n${failures.join('\n')}`).toEqual([]);
  });

  test('(ii) primary controls meet 44x44 target size', async ({ page }) => {
    const offenders: Offender[] = [];

    for (const route of PUBLIC_ROUTES) {
      await open(page, route);

      offenders.push(...(await collectUndersized(page, route)));
    }

    // eslint-disable-next-line no-console
    console.log(
      `[hit-area] undersized (<${MIN_TARGET_PX}px): ${
        offenders.length === 0
          ? 'none'
          : offenders
              .map((o) => `${o.route} <${o.tag}> "${o.name}" ${o.width}x${o.height}`)
              .join(' | ')
      }`,
    );

    expect(
      offenders,
      `controls smaller than ${MIN_TARGET_PX}x${MIN_TARGET_PX} (WCAG 2.5.5):\n` +
        offenders.map((o) => `  ${o.route} <${o.tag}> "${o.name}" → ${o.width}x${o.height}`).join('\n'),
    ).toEqual([]);
  });
});