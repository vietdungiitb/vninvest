import { useState, useCallback, useEffect, useRef } from 'react';
import { coreApiAdapter } from '../adapters/coreApiAdapter.js';
import { extractFeedCursor } from '../utils/feedCursor';

export interface AlertFeedParams {
  symbol?: string;
  severity?: string;
  alert_family?: string;
  session_date?: string;
  timeframe?: string;
  page_size?: number;
  cursor?: string;
}

export interface AlertItem {
  id?: string;
  symbol?: string;
  ts?: string;
  timestamp?: string;
  severity?: string;
  title?: string;
  message?: string;
  [key: string]: unknown;
}

interface AlertFeedResponse {
  results: AlertItem[];
  next: string | null;
  previous: string | null;
}

const POLL_INTERVAL = 15000;

export { extractFeedCursor };

/**
 * Snapshot cảnh báo cho lane tóm tắt trên dashboard.
 *
 * ## Không phân trang (thay đổi Wave 2, 2026-09-27)
 *
 * Trước đây hook này giữ state `nextCursor` + `cursorHistory` và trả
 * `goToNextPage`/`goToPrevPage`/`hasNextPage`/`hasPrevPage`. **Không còn ai
 * dùng** — `DashboardPage.tsx` là consumer duy nhất và sau Wave 2 chỉ lấy
 * `alerts`/`loading`/`error`/`loadInitial`; lane curation cắt còn 5 thẻ rồi
 * link sang `/alert-center`, và Alert Center có cursor handling riêng.
 *
 * Giữ lại sẽ là ~30 dòng code chết **kèm một test giữ nó sống giả** (test đó
 * fail ~50% vì race — đã sửa ở PR #34 nhưng khi đó chưa có lý do để tồn tại).
 * Muốn lấy lại thì `git show 2f3ac0b9:packages/web/src/hooks/useAlertCenterSnapshot.ts`.
 *
 * Hệ quả có lợi: poll 15s không còn phụ thuộc `cursorHistory`, nên luôn đọc
 * trang đầu của scope hiện tại thay vì trang user đang đứng.
 *
 * `AlertFeedParams.cursor` vẫn giữ trong type: `extractFeedCursor` dùng nó
 * khi từ token trần, và `AlertCenterPage` dùng chung hàm này.
 */
export function useAlertCenterSnapshot(initialParams: AlertFeedParams = {}) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Deconstruct primitive values from initialParams to avoid callback dependency invalidation
  const { symbol, severity, alert_family, session_date, timeframe, page_size } = initialParams;

  const fetchFeed = useCallback(async (params: AlertFeedParams, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await (coreApiAdapter as any).getAlertCenterFeed(params) as AlertFeedResponse;
      if (mountedRef.current) setAlerts(data.results || []);
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể tải dữ liệu cảnh báo.';
      if (mountedRef.current) {
        setError(msg);
        setAlerts([]);
      }
      return null;
    } finally {
      if (!silent && mountedRef.current) setLoading(false);
    }
  }, []);

  const loadInitial = useCallback(() => {
    fetchFeed({ symbol, severity, alert_family, session_date, timeframe, page_size });
  }, [fetchFeed, symbol, severity, alert_family, session_date, timeframe, page_size]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (mountedRef.current) {
        fetchFeed({ symbol, severity, alert_family, session_date, timeframe, page_size }, true);
      }
    }, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchFeed, symbol, severity, alert_family, session_date, timeframe, page_size]);

  return { alerts, loading, error, loadInitial };
}
