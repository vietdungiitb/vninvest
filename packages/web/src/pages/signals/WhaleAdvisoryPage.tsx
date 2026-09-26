import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePortfolio } from '../../context/PortfolioContext.js';
import { useI18n } from '../../context/LangContext.js';
import { useConfirm } from '../../components/ConfirmModal.js';
import { useWhaleAdvisoryData } from '../../hooks/useWhaleAdvisoryData.js';
import { WhaleAdvisoryBentoHeader } from '../../components/advisory/WhaleAdvisoryBentoHeader.js';
import { AIAdvisoryWarningBanner } from '../../features/stock-detail/components/AIAdvisoryWarningBanner.js';
import WhaleSymbolSidebar from '../../components/advisory/WhaleSymbolSidebar.jsx';
import { AdvisoryCompareTable } from '../../components/advisory/AdvisoryCompareTable.js';
import { WhaleAdvisoryCommandPanel } from '../../components/advisory/WhaleAdvisoryCommandPanel.jsx';
import { TrustTelemetryPanel } from '../../components/advisory/TrustTelemetryPanel.js';
import { RiskModeSelector } from '../../components/advisory/RiskModeSelector.js';
import { RecommendationHistoryMini } from '../../components/advisory/RecommendationHistoryMini.js';
import { AdvisoryBacktestPanel } from '../../components/advisory/AdvisoryBacktestPanel.js';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';

interface RefreshInfo {
  tokens_used?: number;
  token_budget?: number;
  tokens_remaining_today?: number;
  pct_used?: number;
  budget_soft_warning?: boolean;
  budget_hard_exceeded?: boolean;
  auto_refresh?: boolean;
  auto_refreshes_used_today?: number;
  advisory_max_auto_refreshes_per_day?: number;
  next_refresh_at?: string | number | null;
}

interface SymbolStat {
  symbol: string;
  side?: string | null;
  signal?: string | null;
  confidence?: number | null;
  confidence_score?: number | null;
  isDiscovery?: boolean;
  updatedAt?: string | null;
  updated_at?: string | null;
  /** N3 — mã này đã có tư vấn hay chỉ mới tìm thấy trên thị trường. */
  hasAdvisory?: boolean;
  name?: string;
  exchange?: string;
}

interface AdvisoryItem {
  symbol: string;
  side?: string;
  created_at?: string | null;
  status?: string;
  ai_summary?: string;
  ai_provider?: string;
  ai_model?: string;
  risk_level?: string;
  whale_intensity?: number | null;
  matched_value?: number | null;
  confidence?: number | null;
  is_discovery?: boolean;
}

type RecordOf<T> = Record<string, T>;

interface AdvisoryData {
  items: AdvisoryItem[];
  loading: boolean;
  error: string;
  symbolStats: SymbolStat[];
  statsLoading: boolean;
  /** N3 — kết quả `GET /market-data/symbols/?q=` cho mã chưa có tư vấn. */
  globalMatches: Array<{ symbol: string; name: string; exchange: string }>;
  globalSearchLoading: boolean;
  globalSearchError: string;
  searchGlobalSymbols: (query: string) => Promise<void>;
  refreshInfoMap: RecordOf<RefreshInfo | null>;
  refreshInfoErrors: RecordOf<string>;
  pendingRefreshSymbols: RecordOf<boolean>;
  pendingDeleteSymbols: RecordOf<boolean>;
  rowMessages: RecordOf<string>;
  fetchData: () => Promise<void>;
  loadRefreshInfo: (symbol: string) => Promise<void>;
  handleRefreshAdvisory: (symbol: string) => Promise<void>;
  handleDeleteAdvisory: (symbol: string) => Promise<void>;
}

function fmtTime(ts: string | number | null | undefined, localeTag?: string): string {
  if (!ts) return '--:--';
  return new Date(ts).toLocaleTimeString(localeTag);
}

const EMPTY_DASH = '—';

/*
 * B4 — lỗi mạng mà `fetch` báo ra bằng tiếng Anh. Giữ ở đây (thay vì rải trong
 * JSX) để chỗ hiển thị và chỗ so khớp không lệch nhau. So khớp không phân biệt
 * hoa thường.
 */
const NETWORK_ERRORS = new Set(['failed to fetch', 'networkerror when attempting to fetch resource']);

export function WhaleAdvisoryPage() {
  const { userPlan, activePortfolioId } = usePortfolio() || {};
  const { t, localeTag } = useI18n();
  const confirm = useConfirm();
  const location = useLocation();

  const fromAlert = (() => {
    try {
      return new URLSearchParams(location.search || '').get('from') === 'alert';
    } catch {
      return false;
    }
  })();

  const [riskMode, setRiskMode] = useState(
    () => localStorage.getItem('vninvest:risk-mode') || 'balanced',
  );
  const [activeSymbol, setActiveSymbol] = useState(() => {
    try {
      const query = new URLSearchParams(location.search || '').get('symbol');
      const value = String(query || '').trim().toUpperCase();
      return /^[A-Z0-9]{2,10}$/.test(value) ? value : '';
    } catch {
      return '';
    }
  });
  // N3 — mã đến từ deep-link, giữ cố định suốt phiên để effect chọn mã không
  // xoá mất mà người dùng đã mở bằng đường dẫn.
  const [deepLinkSymbol] = useState(activeSymbol);
  const [compareSymbols, setCompareSymbols] = useState<string[]>([]);
  const [compareNotice, setCompareNotice] = useState('');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const {
    items, loading, error, symbolStats, statsLoading,
    globalMatches, globalSearchLoading, globalSearchError, searchGlobalSymbols,
    refreshInfoMap, refreshInfoErrors, pendingRefreshSymbols,
    pendingDeleteSymbols, rowMessages, fetchData, loadRefreshInfo,
    handleRefreshAdvisory, handleDeleteAdvisory,
  } = (useWhaleAdvisoryData(
    false,
    false,
    activePortfolioId ? { activePortfolioId } : undefined,
  ) || {}) as Partial<AdvisoryData>;

  const itemList: AdvisoryItem[] = useMemo(
    () => (Array.isArray(items) ? items : []),
    [items],
  );
  const statsList: SymbolStat[] = useMemo(
    () => (Array.isArray(symbolStats) ? symbolStats : []),
    [symbolStats],
  );
  const globalMatchList = useMemo(
    () => (Array.isArray(globalMatches) ? globalMatches : []),
    [globalMatches],
  );
  const globalBusy = Boolean(globalSearchLoading);
  const globalErrorText = String(globalSearchError || '');
  const refreshMap: RecordOf<RefreshInfo | null> = refreshInfoMap ?? {};
  const refreshErrors: RecordOf<string> = refreshInfoErrors ?? {};
  const pendingRefresh: RecordOf<boolean> = pendingRefreshSymbols ?? {};
  const pendingDelete: RecordOf<boolean> = pendingDeleteSymbols ?? {};
  const rowMessageMap: RecordOf<string> = rowMessages ?? {};
  const pageLoading = Boolean(loading);
  const pageError = String(error || '');
  const statsBusy = Boolean(statsLoading);

  const noop = async () => {};
  const loadRefreshInfoSafe = useMemo(
    () => loadRefreshInfo ?? noop,
    [loadRefreshInfo],
  );
  const refreshAdvisorySafe = useMemo(
    () => handleRefreshAdvisory ?? noop,
    [handleRefreshAdvisory],
  );
  const deleteAdvisorySafe = useMemo(
    () => handleDeleteAdvisory ?? noop,
    [handleDeleteAdvisory],
  );
  const reload = useMemo(() => fetchData ?? noop, [fetchData]);

  useEffect(() => {
    localStorage.setItem('vninvest:risk-mode', riskMode);
  }, [riskMode]);

  useEffect(() => {
    if (activeSymbol) loadRefreshInfoSafe(activeSymbol);
  }, [activeSymbol, loadRefreshInfoSafe]);

  // N3 — debounce tìm kiếm toàn thị trường.
  //
  // Gõ mỗi ký tự sẽ bắn 1 request; `GET /market-data/symbols/?q=` trả tối đa
  // 12 dòng nên không tốn nặng, nhưng vẫn dễ gây race (kết quả cũ về sau kết
  // quả mới) và làm nhiễu. 300ms là đủ để gõ xong một mã 3–4 chữ cái.
  const searchGlobalSafe = useMemo(
    () => searchGlobalSymbols ?? (async () => {}),
    [searchGlobalSymbols],
  );
  const trimmedSearch = useMemo(() => symbolSearch.trim(), [symbolSearch]);
  useEffect(() => {
    if (trimmedSearch.length < 1) {
      searchGlobalSafe('');
      return undefined;
    }
    const timer = setTimeout(() => {
      searchGlobalSafe(trimmedSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [trimmedSearch, searchGlobalSafe]);

  // Danh sách hiển thị = mã ĐÃ có tư vấn (có số liệu thật) + mã tìm thấy trên
  // toàn thị trường (chưa có tư vấn → `hasAdvisory: false`).
  //
  // Cố ý KHÔNG lọc client-side `statsList` nữa: nếu vẫn lọc, gõ "KBC" khi
  // KBC không nằm trong holdings/watchlist sẽ ra rỗng và người dùng tưởng
  // không có mã đó. Giờ kết quả server quyết định, `statsList` chỉ dùng làm
  // nguồn bổ sung số liệu.
  const filteredStats: SymbolStat[] = useMemo(() => {
    const query = trimmedSearch.toLowerCase();
    const statBySymbol = new Map(statsList.map((row) => [row.symbol, row]));

    if (!query) return statsList;

    const merged: SymbolStat[] = [];
    const seen = new Set<string>();
    for (const match of globalMatchList) {
      if (seen.has(match.symbol)) continue;
      seen.add(match.symbol);
      const stat = statBySymbol.get(match.symbol);
      merged.push({
        ...(stat || { symbol: match.symbol } as SymbolStat),
        symbol: match.symbol,
        name: match.name,
        exchange: match.exchange,
        hasAdvisory: Boolean(stat),
      } as SymbolStat);
    }
    // Mã đang có tư vấn mà server chưa kịp trả về vẫn phải hiện, nếu không
    // danh sách nhấp nháy mất mỗi lần bấm phím.
    for (const stat of statsList) {
      if (seen.has(stat.symbol)) continue;
      if (String(stat.symbol || '').toLowerCase().includes(query)) {
        seen.add(stat.symbol);
        merged.push({ ...stat, hasAdvisory: true } as SymbolStat);
      }
    }
    return merged;
  }, [statsList, globalMatchList, trimmedSearch]);

  useEffect(() => {
    if (filteredStats.length === 0) {
      // N3 — mở deep-link `?symbol=X` phải giữ X kể cả khi X chưa có tư vấn và
      // không nằm trong holdings/watchlist. Trước đây effect này xoá
      // `activeSymbol` ngay, nên `/ai-advisory?symbol=HAG` rơi về màn
      // "Chọn mã chứng khoán" và bỏ qua mã người dùng vừa bấm từ trang khác
      // (ví dụ link "Xem tư vấn" trên Alert Center) — tức tính năng tìm mã bất
      // kỳ không dùng được qua đường dẫn.
      //
      // Vẫn bỏ chọn khi đang gõ tìm kiếm và không có kết quả: giữ mã cũ sẽ khiến
      // người dùng tưởng kết quả tìm kiếm đang áp dụng cho mã đó.
      if (!trimmedSearch && !deepLinkSymbol) setActiveSymbol('');
      return;
    }
    const stillExists = filteredStats.some((row) => row.symbol === activeSymbol);
    if (!stillExists) setActiveSymbol(filteredStats[0].symbol);
  }, [activeSymbol, filteredStats, trimmedSearch, deepLinkSymbol]);

  const activeItem = useMemo(() => {
    if (!activeSymbol) return null;
    const createdAt = (item: AdvisoryItem) => {
      if (!item?.created_at) return 0;
      const parsed = new Date(item.created_at).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };
    return (
      itemList
        .filter((item) => item.symbol === activeSymbol)
        .sort((a, b) => createdAt(b) - createdAt(a))[0] || null
    );
  }, [activeSymbol, itemList]);

  const refreshInfo = activeSymbol ? refreshMap[activeSymbol] || null : null;
  const refreshInfoError = activeSymbol ? refreshErrors[activeSymbol] || '' : '';

  const budgetSoftWarning = Boolean(
    refreshInfo
    && (refreshInfo.budget_soft_warning === true
      || (refreshInfo.pct_used != null && refreshInfo.pct_used >= 80 && refreshInfo.pct_used < 100)),
  );

  const bannerBudget = refreshInfo && refreshInfo.token_budget
    ? {
      token_budget: refreshInfo.token_budget,
      tokens_used: refreshInfo.tokens_used ?? 0,
      pct_used: refreshInfo.pct_used ?? 0,
    }
    : null;

  const toggleCompareSymbol = (symbol: string) => {
    const value = String(symbol || '').trim().toUpperCase();
    if (!value) return;
    setCompareSymbols((previous) => {
      if (previous.includes(value)) {
        setCompareNotice('');
        return previous.filter((item) => item !== value);
      }
      if (previous.length >= 5) {
        setCompareNotice(t('aiAdvisory.compare.maxReached', { defaultValue: 'Tối đa 5 mã.' }));
        return previous;
      }
      setCompareNotice('');
      return [...previous, value];
    });
  };

  const removeCompareSymbol = (symbol: string) => {
    setCompareSymbols((previous) => previous.filter((item) => item !== symbol));
  };

  const requestDeleteAdvisory = async (symbol: string) => {
    const confirmed = await confirm({
      title: t('aiAdvisory.delete.title', { defaultValue: 'Xóa tư vấn' }),
      message: t('aiAdvisory.delete.message', {
        symbol,
        defaultValue: `Xóa tư vấn hiện tại của ${symbol}?`,
      }),
      confirmText: t('aiAdvisory.delete.confirm', { defaultValue: 'Xác nhận' }),
      variant: 'destructive',
    });
    if (confirmed) await deleteAdvisorySafe(symbol);
  };

  return (
    <div className="advisory-page mx-auto max-w-[1800px] px-4 py-6 lg:px-8 space-y-6 min-h-dvh">
      <WhaleAdvisoryBentoHeader
        userPlan={userPlan}
        statsLoading={statsBusy}
        onRefresh={reload}
      />

      {fromAlert ? (
        <Link
          to={`/alert-center${activeSymbol ? `?symbol=${encodeURIComponent(activeSymbol)}` : ''}`}
          className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          {`← ${t('aiAdvisory.backFromAlerts', { defaultValue: 'Trung tâm cảnh báo' })}`}
        </Link>
      ) : null}

      {pageLoading && itemList.length === 0 ? (
        <div className="space-y-4" aria-busy="true">
          {[1, 2, 3].map((row) => (
            <div key={row} className="h-24 animate-pulse rounded-2xl bg-slate-800/50" />
          ))}
        </div>
      ) : null}

      {!pageLoading && refreshInfoError ? (
        <div
          role="status"
          className="rounded-lg border border-amber-700/60 bg-amber-950/30 p-3 text-xs text-amber-200"
        >
          {t('aiAdvisory.refreshInfo.error', {
            defaultValue: 'Không tải được hạn mức làm mới. Cảnh báo ngân sách token đang tạm ẩn.',
          })}
        </div>
      ) : null}

      {!pageLoading && refreshInfo ? (
        <AIAdvisoryWarningBanner
          personalKeyFailed={false}
          personalKeyError=""
          usingSystemFallback={false}
          fallbackRemaining={undefined}
          fallbackQuotaMax={undefined}
          fallbackQuotaReset={null}
          budgetSoftWarning={budgetSoftWarning}
          budget={bannerBudget}
          onConfigure={undefined}
        />
      ) : null}

      {/*
        Layout 2 cột dùng `lg` (1024px), KHÔNG dùng `xl` (1280px).

        Lý do: shell bọc nội dung trong `max-w-[var(--layout-content-max-width)]`
        = 80rem = 1280px, rồi `main` cộng thêm padding ngang 2 × 24px
        (`index.css:109`, `FullLayout.tsx:92-95`). Nội dung thực sự chỉ còn
        1280 − 48 = 1232px. Breakpoint `xl` = 1280px nên không bao giờ kích
        hoạt, trang luôn rơi về 1 cột và trông như bản mobile dù màn hình rộng.
        `lg` = 1024px mới là mốc đúng cho không gian thực tế.
      */}
      {pageError ? (
        <div
          role="alert"
          data-testid="advisory-error-banner"
          className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-6 text-center"
        >
          <p className="text-sm font-bold uppercase tracking-widest text-rose-400">
            {t('common.error', { defaultValue: 'Lỗi' })}
          </p>
          <p className="mt-2 text-slate-300">
            {t('aiAdvisory.error.loadFailed', {
              defaultValue: 'Không tải được dữ liệu tư vấn.',
            })}
          </p>
          {error !== 'fetch-failed' ? (
            /*
             * B4 — không hiện thông báo kỹ thuật tiếng Anh cho người dùng.
             * Bằng chứng: ảnh `advisory-dark-error.png` hiện "Failed to fetch"
             * (raw error của `fetch`) ngay dưới câu tiếng Việt. Giữ nguyên chuỗi
             * gốc trong `title` để hỗ trợ tra cứu, còn dòng hiển thị dùng thông
             * điệp đã bản địa. Mã lỗi nội bộ (không phải lỗi mạng) vẫn hiện
             * nguyên vì nó có giá trị chẩn đoán thật.
             */
            <p
              className="mt-1 font-mono text-xs text-slate-500"
              data-testid="advisory-error-code"
              title={pageError}
            >
              {NETWORK_ERRORS.has(String(pageError).toLowerCase())
                ? t('aiAdvisory.error.network', {
                    defaultValue: 'Không kết nối được tới máy chủ. Kiểm tra mạng rồi thử lại.',
                  })
                : pageError}
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={reload}
          >
            {t('aiAdvisory.error.retry', { defaultValue: 'Thử lại' })}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <main className="min-w-0 space-y-4">
            <WhaleAdvisoryCommandPanel
              item={activeItem}
              activeSymbol={activeSymbol}
              hasAnyAdvisory={itemList.length > 0}
              onRefresh={refreshAdvisorySafe}
              onDeleteCurrent={requestDeleteAdvisory}
              refreshing={Boolean(pendingRefresh[activeSymbol])}
              deleting={Boolean(pendingDelete[activeSymbol])}
              rowMessage={rowMessageMap[activeSymbol]}
            />

            {compareSymbols.length > 0 || compareNotice ? (
              <section className="neon-glass-panel p-4" aria-label={t('aiAdvisory.compare.title', { defaultValue: 'So sánh đa mã' })}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-200">
                    {t('aiAdvisory.compare.title', { defaultValue: 'So sánh đa mã' })}
                  </h3>
                  <span className="text-[10px] text-slate-500">
                    {compareNotice || t('aiAdvisory.compare.hint', {
                      defaultValue: 'Chọn tối đa 5 mã ở sidebar để so sánh.',
                    })}
                  </span>
                </div>
                <AdvisoryCompareTable
                  symbols={compareSymbols}
                  symbolStats={symbolStats}
                  items={itemList}
                  onRemove={removeCompareSymbol}
                />
              </section>
            ) : null}

            <section className="advisory-surface neon-glass-panel p-3">
              <Tabs defaultValue="risk">
                <TabsList className="grid grid-cols-3 gap-2" aria-label={t('aiAdvisory.tabGroup', { defaultValue: 'Dữ liệu hỗ trợ tư vấn' })}>
                  <TabsTrigger value="risk">
                    {t('aiAdvisory.tab.risk', { defaultValue: 'Rủi ro' })}
                  </TabsTrigger>
                  <TabsTrigger value="history">
                    {t('aiAdvisory.tab.history', { defaultValue: 'Lịch sử' })}
                  </TabsTrigger>
                  <TabsTrigger value="backtest">
                    {t('aiAdvisory.backtest.tab', { defaultValue: 'Backtest' })}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="risk" className="mt-3">
                  <RiskModeSelector symbol={activeSymbol} value={riskMode} onChange={setRiskMode} />
                </TabsContent>
                <TabsContent value="history" className="mt-3">
                  <RecommendationHistoryMini symbol={activeSymbol} limit={6} />
                </TabsContent>
                <TabsContent value="backtest" className="mt-3">
                  <AdvisoryBacktestPanel symbol={activeSymbol} />
                </TabsContent>
              </Tabs>
            </section>

            <details className="advisory-surface neon-glass-panel p-3" data-testid="advisory-local-telemetry">
              <summary className="cursor-pointer text-[11px] font-black uppercase tracking-widest text-slate-400">
                {t('aiAdvisory.telemetry.localTitle', { defaultValue: 'Nhật ký sử dụng trên máy này' })}
              </summary>
              <p className="mt-2 text-[11px] text-slate-500">
                {t('aiAdvisory.telemetry.localHint', {
                  defaultValue: 'Chỉ ghi lại thao tác của bạn trên trình duyệt này, không gửi lên máy chủ.',
                })}
              </p>
              <div className="mt-3">
                <TrustTelemetryPanel />
              </div>
            </details>
          </main>

          <div className="lg:sticky lg:top-4 lg:self-start">
            <WhaleSymbolSidebar
              symbolStats={filteredStats}
              symbolSearch={symbolSearch}
              setSymbolSearch={setSymbolSearch}
              activeSymbol={activeSymbol}
              setActiveSymbol={setActiveSymbol}
              page={page}
              setPage={setPage}
              pageSize={pageSize}
              setPageSize={setPageSize}
              compareSymbols={compareSymbols}
              onToggleCompare={toggleCompareSymbol}
              searchLoading={globalBusy}
              searchError={globalErrorText}
            />
          </div>
        </div>
      )}

      {refreshInfo ? (
        <footer className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>
            {t('aiAdvisory.footer.tokensRemaining', { defaultValue: 'Token còn lại' })}:{' '}
            <span className="font-mono text-cyan-400">
              {(refreshInfo.tokens_remaining_today ?? 0).toLocaleString(localeTag)}
            </span>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {t('aiAdvisory.footer.refreshQuota', { defaultValue: 'Hạn mức làm mới' })}:{' '}
            <span className="font-mono text-emerald-400">
              {refreshInfo.auto_refreshes_used_today ?? 0}
              /{refreshInfo.advisory_max_auto_refreshes_per_day ?? EMPTY_DASH}
            </span>
          </span>
          {refreshInfo.next_refresh_at ? (
            <>
              <span aria-hidden="true">·</span>
              <span>
                {t('aiAdvisory.footer.nextCycle', { defaultValue: 'Chu kỳ tiếp theo' })}:{' '}
                <span className="font-mono text-amber-400">
                  {fmtTime(refreshInfo.next_refresh_at, localeTag)}
                </span>
              </span>
            </>
          ) : null}
        </footer>
      ) : null}
    </div>
  );
}

export default WhaleAdvisoryPage;
