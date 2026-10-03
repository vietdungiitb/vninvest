import { memo } from 'react';
import { useI18n } from '../../context/LangContext.js';
import PaginationBar from '../shared/PaginationBar.jsx';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

/**
 * R2.3 — chỉ hiện cột có dữ liệu thật.
 *
 * Trước W0 sidebar render `whaleIntensity` / `buyCount` / `sellCount` / `GD`.
 * Cả 4 đều luôn bằng 0 vì `GET /portfolio/ai-advisory-symbol-stats/` là stub
 * trả `{'stats': []}`. Đó là số liệu bịa, không phải thiếu dữ liệu. Nay endpoint
 * đã implement thật (R0.6) nên cột lấy từ `side` / `confidence` / `updatedAt`
 * có nguồn thật; không có thì hiện `—`.
 *
 * R2.6 — bỏ badge "LIVE" tĩnh vì nó không đại diện trạng thái kết nối.
 * R4.6 — `role="checkbox"` lồng trong `<button>` là nested interactive, bị bỏ;
 * nút so sánh nay là `<button>` riêng nằm ngoài `<button>` chọn mã.
 */

const SIDE_TONE = {
  BUY: 'text-emerald-400',
  SELL: 'text-rose-400',
  HOLD: 'text-slate-300',
  UNKNOWN: 'text-slate-600',
};

function formatUpdatedAt(value, localeTag) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' });
}

function WhaleSymbolSidebar({
  symbolStats,
  symbolSearch,
  setSymbolSearch,
  activeSymbol,
  setActiveSymbol,
  page,
  setPage,
  pageSize,
  setPageSize,
  compareSymbols,
  onToggleCompare,
  searchLoading = false,
  searchError = '',
}) {
  const { t, localeTag } = useI18n();
  const list = Array.isArray(symbolStats) ? symbolStats : [];

  const pagedStats = symbolSearch
    ? list
    : list.slice((page - 1) * pageSize, page * pageSize);
  const searchLabel = t('aiAdvisory.sidebar.search', { defaultValue: 'Tìm mã chứng khoán' });

  return (
    <aside
      className="advisory-surface flex flex-col h-full neon-glass-panel overflow-hidden"
      aria-label={t('aiAdvisory.sidebar.title', { defaultValue: 'Mã đang theo dõi' })}
    >
      <div className="p-4 border-b border-slate-800/60">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          {/* N3 — tiêu đề cũ "Mã đang theo dõi" sai khi đã tìm được mã bất kỳ. */}
          {symbolSearch
            ? t('aiAdvisory.sidebar.searchTitle', { defaultValue: 'Kết quả tìm kiếm' })
            : t('aiAdvisory.sidebar.title', { defaultValue: 'Mã đang theo dõi' })}
        </h3>
        <div className="relative mt-3">
          <Input
            type="search"
            aria-label={searchLabel}
            placeholder={t('aiAdvisory.sidebar.searchPlaceholder', { defaultValue: 'Tìm mọi mã chứng khoán…' })}
            value={symbolSearch}
            onChange={(event) => {
              setSymbolSearch(event.target.value);
              setPage(1);
            }}
            className="w-full"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto panel-scrollbar p-2">
        {pagedStats.length > 0 ? (
          <>
            {searchError ? (
              <p role="alert" className="mx-2 mb-2 rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-[11px] text-rose-300">
                {searchError}
              </p>
            ) : null}
            <ul className="space-y-1">
            {pagedStats.map((item) => {
              const isActive = activeSymbol === item.symbol;
              const inCompare = Array.isArray(compareSymbols) && compareSymbols.includes(item.symbol);
              // N3 — mã tìm thấy trên thị trường nhưng chưa có tư vấn thì không
              // được hiện số 0 hay `UNKNOWN` như thể đã phân tích xong. Cờ
              // `hasAdvisory` do page gắn; mặc định `true` để mọi lời gọi cũ
              // (chỉ truyền `symbolStats`) giữ nguyên hành vi.
              const hasAdvisory = item.hasAdvisory !== false;
              const side = hasAdvisory
                ? String(item.side || item.signal || 'UNKNOWN').toUpperCase()
                : 'UNKNOWN';
              const confidence = item.confidence ?? item.confidence_score ?? null;
              const updated = formatUpdatedAt(item.updatedAt || item.updated_at, localeTag);

              return (
                <li key={item.symbol} className="relative">
                  <button
                    type="button"
                    aria-label={t('aiAdvisory.sidebar.selectSymbol', { symbol: item.symbol })}
                    aria-current={isActive ? 'true' : undefined}
                    onClick={() => setActiveSymbol(item.symbol)}
                    className={[
                      'w-full text-left p-3 rounded-2xl transition-colors border',
                      isActive
                        ? 'bg-cyan-500/10 border-cyan-500/30'
                        : 'border-transparent hover:bg-slate-800/40',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={[
                          'text-sm font-bold tracking-tight',
                          isActive ? 'text-cyan-400' : 'text-slate-200',
                        ].join(' ')}
                      >
                        {item.symbol}
                        {item.isDiscovery ? (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 text-[9px] font-black uppercase border border-amber-500/30">
                            {t('aiAdvisory.sidebar.discovery', { defaultValue: 'Disc' })}
                          </span>
                        ) : null}
                        {!hasAdvisory ? (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-400 text-[9px] font-black uppercase border border-slate-600/50">
                            {t('aiAdvisory.sidebar.noAdvisory', { defaultValue: 'Chưa tư vấn' })}
                          </span>
                        ) : null}
                      </span>
                      <span className={`text-xs font-mono font-bold ${SIDE_TONE[side] || SIDE_TONE.UNKNOWN}`}>
                        {side === 'UNKNOWN'
                          ? '—'
                          : t(`aiAdvisory.side.${side.toLowerCase()}`, { defaultValue: side })}
                      </span>
                    </div>
                    {item.name ? (
                      <div className="mt-1 truncate text-[10px] text-slate-500">
                        {item.name}
                        {item.exchange ? (
                          <span className="ml-1 font-mono text-slate-600">{item.exchange}</span>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="mt-1 flex items-center gap-3 text-[9px] text-slate-600">
                      <span>
                        {t('aiAdvisory.sidebar.confidence', { defaultValue: 'Tin cậy' })}:{' '}
                        <span className="font-mono text-slate-400">
                          {confidence == null ? '—' : `${confidence}%`}
                        </span>
                      </span>
                      <span>
                        {t('aiAdvisory.sidebar.updated', { defaultValue: 'Cập nhật' })}:{' '}
                        <span className="font-mono text-slate-400">{updated || '—'}</span>
                      </span>
                    </div>
                  </button>
                  {onToggleCompare ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-pressed={inCompare}
                      title={t('aiAdvisory.compare.action', { defaultValue: 'So sánh' })}
                      onClick={() => onToggleCompare(item.symbol)}
                      className="mt-1 w-full text-[10px]"
                    >
                      {inCompare
                        ? t('aiAdvisory.compare.selected', { defaultValue: '✓ SS' })
                        : t('aiAdvisory.compare.add', { defaultValue: '+ SS' })}
                    </Button>
                  ) : null}
                </li>
              );
            })}
            </ul>
            {searchLoading ? (
              <p className="px-4 py-3 text-center text-xs text-slate-500" aria-live="polite">
                {t('aiAdvisory.sidebar.searching', { defaultValue: 'Đang tìm…' })}
              </p>
            ) : null}
          </>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-slate-500 italic">
            {symbolSearch
              ? (searchError
                || t('aiAdvisory.sidebar.emptySearch', { defaultValue: 'Không tìm thấy mã nào phù hợp' }))
              : t('aiAdvisory.sidebar.empty', { defaultValue: 'Chưa có mã nào đang được theo dõi' })}
          </p>
        )}
      </div>

      <div className="bg-slate-900/60 backdrop-blur-md border-t border-slate-800/60">
        {/* N3 — khi đang tìm kiếm, kết quả do server giới hạn 12 dòng nên
            phân trang offset chỉ gây hiểu nhầm ("Tổng 12 mã" + nút trang 2
            không dẫn tới đâu). Ẩn hẳn, chỉ giữ khi xem danh sách đầy đủ. */}
        {symbolSearch ? (
          <div className="bg-slate-950/40 px-4 py-2">
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">
              {t('aiAdvisory.sidebar.total', { count: list.length, defaultValue: 'Tổng: {count} mã' })}
            </span>
          </div>
        ) : (
          <>
            <PaginationBar
              mode="offset"
              total={list.length}
              page={page}
              size={pageSize}
              onPageChange={setPage}
              onSizeChange={setPageSize}
            />
            <div className="bg-slate-950/40 px-4 py-2 border-t border-slate-800/30">
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">
                {t('aiAdvisory.sidebar.total', { count: list.length, defaultValue: 'Tổng: {count} mã' })}
              </span>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

export default memo(WhaleSymbolSidebar);
