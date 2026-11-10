/**
 * useTenantTier — app-side tier gating (P3.4).
 *
 * Source of truth: `Subscription.plan` qua `GET /billing/subscription`
 * (xem docs/PLAN_P34_TIER_20261110.md §1). Mọi lỗi/403/thiếu subscription/
 * status không active|trialing → 'free' (fail-closed), không throw.
 *
 * KHÔNG dùng widget-internal tier: envelope mismatch (BE bọc `{data:{...}}`,
 * widget đọc raw `M.plan`) + thiếu `client` khiến validate không bao giờ
 * chạy (chi tiết trong plan). KHÔNG gọi `registerProExtension` (chưa có key).
 */
import { useEffect, useState } from 'react';

/** plan code (backend canonical) -> UI tier. custom ve enterprise (paid/unlimited). */
export function mapPlanToTier(plan) {
  switch (String(plan || '').toLowerCase()) {
    case 'enterprise':
    case 'internal':
    case 'custom':
      return 'enterprise';
    case 'pro':
      return 'pro';
    default:
      return 'free';
  }
}

function isBillableStatus(status) {
  const s = String(status || '').toLowerCase();
  return s === 'active' || s === 'trialing';
}

/** Subscription payload (có thể null) -> tier. */
export function resolveTierFromSubscription(sub) {
  if (!sub || typeof sub !== 'object') return 'free';
  if (!isBillableStatus(sub.status)) return 'free';
  return mapPlanToTier(sub.plan ?? sub.plan_name);
}

const cache = { value: undefined };

/**
 * @returns {{ tier: 'free'|'pro'|'enterprise', loading: boolean, plan: string|null }}
 */
export function useTenantTier() {
  const [state, setState] = useState(() =>
    cache.value === undefined ? { tier: 'free', loading: true, plan: null } : { ...cache.value, loading: false },
  );

  useEffect(() => {
    if (cache.value !== undefined) return;
    let active = true;
    (async () => {
      try {
        const { coreApiAdapter } = await import('./coreApiAdapter.js');
        const sub = await coreApiAdapter.getBillingSubscription();
        // Envelope: { data: {...} } hoặc payload trần — lấy data nếu có.
        const payload = sub && typeof sub === 'object' && 'data' in sub ? sub.data : sub;
        if (active) {
          cache.value = { tier: resolveTierFromSubscription(payload), loading: false, plan: payload?.plan ?? payload?.plan_name ?? null };
          setState({ ...cache.value });
        }
      } catch (_) {
        // 403 (thiếu billing:read), mạng lỗi, không subscription → free.
        if (active) {
          cache.value = { tier: 'free', loading: false, plan: null };
          setState({ ...cache.value });
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return state;
}
