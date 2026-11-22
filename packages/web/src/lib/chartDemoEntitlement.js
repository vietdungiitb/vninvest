/**
 * Host-side server entitlement for the chart widget.
 *
 * Mirrors the demo blueprint (vninvestcharts-widget `src/demo/serverEntitlement.ts`):
 * the browser calls our own same-origin endpoint; the browser NEVER holds a SaaS PAT.
 * The tier is resolved BEFORE first render so the chart cannot flash FREE.
 *
 * Fail-closed: any error/non-ok/timeout resolves to `free`.
 */

export const ENTITLEMENT_URL = '/api/v1/entitlement';
export const PRELOAD_TIMEOUT_MS = 2500;

let preloadPromise = null;
let stashedTier = null;

/** Map a SaaS tier/plan code to the widget tier vocabulary. */
export function mapChartTier(raw) {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'enterprise' || value === 'internal' || value === 'custom') return 'enterprise';
  if (value === 'pro') return 'pro';
  if (value === 'starter') return 'starter';
  return 'free';
}

/** Resolve tier from the same-origin entitlement endpoint. */
export async function fetchChartEntitlement(fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl(ENTITLEMENT_URL, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return { tier: 'free', active: false };
    const body = await response.json();
    const raw = body?.tier_code ?? body?.plan ?? '';
    return {
      tier: mapChartTier(raw),
      active: (body?.status ?? 'active') === 'active',
    };
  } catch {
    return { tier: 'free', active: false };
  }
}

/**
 * Start the entitlement lookup once. Concurrent callers share the same promise.
 * The timeout is a fail-closed control, not a retry: a slow server must not hang the app.
 */
export function preloadChartEntitlement(fetchImpl = globalThis.fetch) {
  if (!preloadPromise) {
    const timeout = new Promise((resolve) => {
      setTimeout(() => resolve({ tier: 'free', active: false }), PRELOAD_TIMEOUT_MS);
    });
    preloadPromise = Promise.race([fetchChartEntitlement(fetchImpl), timeout]).then((result) => {
      stashedTier = result.tier;
      return result;
    });
  }
  return preloadPromise;
}

/**
 * Synchronous first-render read. Blueprint mirror: `free` is represented as `null`
 * so an unresolved/negative entitlement never forces a tier prop onto the widget.
 */
export function readPreloadedChartTier() {
  if (!stashedTier || stashedTier === 'free') return null;
  return stashedTier;
}

/** Test seam: clear the shared promise + stash between cases. */
export function resetChartEntitlementForTests() {
  preloadPromise = null;
  stashedTier = null;
}
