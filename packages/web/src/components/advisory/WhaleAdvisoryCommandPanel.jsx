import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../context/LangContext.js';
import { downloadAdvisoryCsv, copyAdvisoryShareLink } from './advisoryExport.js';
import { AdvisoryAlertDialog } from './AdvisoryAlertDialog.js';
import { AdvisoryOrderTicket } from './AdvisoryOrderTicket.js';
import Can from '../shared/Can.jsx';
import { RecommendationCardExplainability } from './RecommendationCardExplainability.js';
import { ActionChecklist } from './ActionChecklist.js';
import { AgenticThoughtStream } from './AgenticThoughtStream.js';
import { Button } from '../ui/button';

const EMPTY_DASH = '—';

const SIDE_STYLE = {
  BUY: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  SELL: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  HOLD: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
  UNKNOWN: 'bg-slate-800/60 text-slate-500 border-slate-700/60',
};

function fmtTime(ts, localeTag) {
  return ts ? new Date(ts).toLocaleTimeString(localeTag) : EMPTY_DASH;
}

function formatNumber(value, localeTag) {
  if (value == null) return null;
  return Number(value).toLocaleString(localeTag);
}

function Metric({ label, value, tone = 'text-white', testId }) {
  return (
    <div className="rounded-xl border border-slate-800/40 bg-slate-900/30 p-3">
      <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-slate-500">
        {label}
      </div>
      <div className={`font-mono text-lg font-black ${tone}`} data-testid={testId}>
        {value}
      </div>
    </div>
  );
}

/**
 * R4.1 — ba empty state riêng biệt.
 * Trước đây mọi trường hợp (chưa chọn mã / mã chưa có tư vấn / lỗi) đều hiện
 * "Chưa có mã nào đang hoạt động", mâu thuẫn với header đang hiện tên mã đã chọn.
 *
 * R4.2 — `whale_intensity` và `matched_value` trước đây `|| 0` nên hiện "0%" /
 * "0 VNĐ" khi không có dữ liệu. Nay `null` -> `—`, giống hành xử của confidence.
 */
export function WhaleAdvisoryCommandPanel({
  item,
  activeSymbol,
  hasAnyAdvisory,
  onRefresh,
  onDeleteCurrent,
  refreshing,
  deleting,
  rowMessage,
}) {
  const { t, localeTag } = useI18n();
  const [shareState, setShareState] = useState('');
  const [dialog, setDialog] = useState(null);

  const advisory = item || {};
  const resolvedSymbol = String(activeSymbol || advisory.symbol || '').toUpperCase();
  const hasAdvisory = Boolean(item);
  const side = String(advisory.side || 'UNKNOWN').toUpperCase();

  const intensity = advisory.whale_intensity ?? null;
  const referencePrice = formatNumber(advisory.matched_value, localeTag);
  const confidence = advisory.confidence ?? null;

  const flash = (message) => {
    setShareState(message);
    setTimeout(() => setShareState(''), 2500);
  };

  const renderEmptyState = () => {
    if (!resolvedSymbol) {
      return (
        <p className="py-16 text-center text-sm text-slate-500" data-testid="empty-no-symbol">
          {t('aiAdvisory.empty.noSymbol', { defaultValue: 'Chọn một mã ở danh sách bên phải để bắt đầu.' })}
        </p>
      );
    }
    return (
      <div className="py-16 text-center" data-testid="empty-no-advisory">
        <p className="text-sm text-slate-400">
          {t('aiAdvisory.empty.noAdvisoryForSymbol', {
            symbol: resolvedSymbol,
            defaultValue: `Mã ${resolvedSymbol} chưa có tư vấn cho phiên hôm nay.`,
          })}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {hasAnyAdvisory
            ? t('aiAdvisory.empty.noAdvisoryHint', { defaultValue: 'Bấm Làm mới để tạo tư vấn cho mã này.' })
            : t('aiAdvisory.empty.noAdvisoryHintNoData', {
              defaultValue: 'Bấm Làm mới để tạo tư vấn đầu tiên.',
            })}
        </p>
      </div>
    );
  };

  return (
    <section
      className={`advisory-surface flex flex-col neon-glass-panel overflow-hidden ${
        refreshing ? 'shadow-[0_0_35px_rgba(6,182,212,0.5)] border-cyan-500/60' : ''
      }`}
      aria-label={t('aiAdvisory.panel.label', { defaultValue: 'Tư vấn AI' })}
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800/60 p-5">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h2 className="text-2xl font-black tracking-tight text-white">
              {resolvedSymbol || t('aiAdvisory.empty.chooseSymbol', { defaultValue: 'Chọn mã chứng khoán' })}
            </h2>
            {hasAdvisory ? (
              <span
                className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${SIDE_STYLE[side] || SIDE_STYLE.UNKNOWN}`}
                data-testid="advisory-side-badge"
              >
                {side}
              </span>
            ) : null}
            {advisory.is_discovery ? (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-500">
                {t('aiAdvisory.discovery', { defaultValue: 'Discovery' })}
              </span>
            ) : null}
          </div>
          <p className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">
            <span
              className={`h-1.5 w-1.5 rounded-full ${hasAdvisory ? 'bg-cyan-500' : 'bg-slate-700'}`}
              aria-hidden="true"
            />
            {`${t('aiAdvisory.analysisTime', { defaultValue: 'Phân tích lúc' })} ${fmtTime(advisory.created_at, localeTag)}`}
          </p>
        </div>
        <Button
          type="button"
          loading={refreshing}
          disabled={!resolvedSymbol || refreshing}
          onClick={() => onRefresh?.(resolvedSymbol)}
        >
          {refreshing
            ? t('aiAdvisory.action.refreshing', { defaultValue: 'Đang tải…' })
            : t('aiAdvisory.action.refresh', { defaultValue: 'Làm mới' })}
        </Button>
      </header>

      <div className="flex-1 space-y-5 p-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric
            label={t('aiAdvisory.whaleIntensity', { defaultValue: 'Cường độ dòng tiền' })}
            value={intensity == null ? EMPTY_DASH : `${intensity}%`}
            testId="metric-intensity"
          />
          <Metric
            label={t('aiAdvisory.confidence', { defaultValue: 'Độ tin cậy' })}
            value={confidence == null ? EMPTY_DASH : `${confidence}%`}
            tone="text-cyan-400"
            testId="metric-confidence"
          />
          <Metric
            label={t('aiAdvisory.status', { defaultValue: 'Trạng thái' })}
            value={hasAdvisory
              ? (advisory.status || t('aiAdvisory.active', { defaultValue: 'Đang hoạt động' }))
              : t('aiAdvisory.waiting', { defaultValue: 'Chờ' })}
            testId="metric-status"
          />
          <Metric
            label={t('aiAdvisory.referencePrice', { defaultValue: 'Giá trị tham chiếu' })}
            value={referencePrice == null ? EMPTY_DASH : referencePrice}
            testId="metric-reference"
          />
        </div>

        {hasAdvisory ? (
          <>
            <section aria-label={t('aiAdvisory.thought.title', { defaultValue: 'Dòng suy nghĩ' })}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-200">
                  {t('aiAdvisory.thought.title', { defaultValue: 'Dòng suy nghĩ' })}
                </h3>
                <span className="text-[10px] font-mono text-slate-600">
                  {`${advisory.ai_provider || EMPTY_DASH} / ${advisory.ai_model || EMPTY_DASH}`}
                </span>
              </div>
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/30 p-5">
                <AgenticThoughtStream content={advisory.ai_summary} />
              </div>
              {advisory.risk_level && advisory.risk_level !== 'unknown' ? (
                <p className="mt-2 text-xs text-slate-500">
                  {`${t('aiAdvisory.riskLevel', { defaultValue: 'Mức rủi ro' })}: ${
                    t(`aiAdvisory.risk.${advisory.risk_level}`, { defaultValue: advisory.risk_level })
                  }`}
                </p>
              ) : null}
            </section>

            <RecommendationCardExplainability advisory={advisory} />

            <ActionChecklist
              symbol={resolvedSymbol}
              onProceed={() => onRefresh?.(resolvedSymbol)}
            />
          </>
        ) : renderEmptyState()}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/60 bg-slate-900/40 px-5 py-3">
        <div className="flex-1" aria-live="polite">
          {rowMessage ? (
            <p className="text-[11px] font-bold text-cyan-400">{rowMessage}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {/* R2.5 — nhãn trước đây gọi "Bảng điều khiển cá voi" nhưng trỏ
                  tới /alert-center, gây hiểu nhầm. Nay chỉ còn một link trỏ đúng
                  nơi và nhãn nói đúng nơi đó. */}
              <Link
                to={`/stocks/${resolvedSymbol}`}
                className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
              >
                {t('aiAdvisory.action.workspace', { defaultValue: 'Trang cổ phiếu' })}
              </Link>
              {hasAdvisory ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const count = downloadAdvisoryCsv([advisory], `advisory-${resolvedSymbol || 'current'}.csv`);
                      flash(t('aiAdvisory.export.done', { count, defaultValue: `Đã xuất ${count} dòng.` }));
                    }}
                    className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {t('aiAdvisory.export.current', { defaultValue: 'Xuất CSV' })}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await copyAdvisoryShareLink(resolvedSymbol);
                        flash(t('aiAdvisory.share.copied', { defaultValue: 'Đã copy link!' }));
                      } catch {
                        flash(t('aiAdvisory.share.failed', { defaultValue: 'Không copy được link.' }));
                      }
                    }}
                    className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {t('aiAdvisory.share.action', { defaultValue: 'Chia sẻ' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialog('alert')}
                    className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {t('aiAdvisory.alert.open', { defaultValue: 'Tạo cảnh báo' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialog('order')}
                    className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {t('aiAdvisory.order.open', { defaultValue: 'Lệnh thử nghiệm' })}
                  </button>
                </>
              ) : null}
              {shareState ? (
                <span className="text-[10px] font-bold text-cyan-400">{shareState}</span>
              ) : null}
            </div>
          )}
        </div>
        {hasAdvisory && onDeleteCurrent ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={deleting || refreshing}
            onClick={() => onDeleteCurrent(resolvedSymbol)}
            className="text-rose-400 hover:text-rose-300"
          >
            {deleting
              ? t('aiAdvisory.delete.inProgress', { defaultValue: 'Đang xóa…' })
              : t('aiAdvisory.delete.action', { defaultValue: 'Xóa tư vấn' })}
          </Button>
        ) : null}
      </footer>

      {dialog === 'alert' && hasAdvisory ? (
        <AdvisoryAlertDialog
          advisory={advisory}
          symbol={resolvedSymbol}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === 'order' && hasAdvisory ? (
        <AdvisoryOrderTicket
          advisory={advisory}
          symbol={resolvedSymbol}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </section>
  );
}

export default WhaleAdvisoryCommandPanel;
