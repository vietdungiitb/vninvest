/**
 * RecommendationCardExplainability — Explainability card for Whale Advisory
 * Converted from JSX to createElement pattern
 */
import { createElement, useState } from 'react';
import { useI18n } from '../../context/LangContext.js';
import { useTrustTelemetry } from '../../hooks/useTrustTelemetry.js';

const e = createElement;

function attributionPercent(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const percent = value > 0 && value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, percent));
}

export function RecommendationCardExplainability({
  advisory,
  freshnessSeconds = null,
  realtimeStatus = 'idle',
}) {
  const [open, setOpen] = useState(false);
  const { t, localeTag } = useI18n();
  const { trackExplainabilityOpened, trackExplainabilityInsufficient } = useTrustTelemetry();

  if (!advisory) return null;

  const { symbol, ai_summary, ai_detail, ai_provider, ai_model, generated_at, feature_attribution, input_snapshot, confidence: rawConfidence } = advisory;
  const attributionRows = [
    { key: 'whale', value: attributionPercent(feature_attribution?.whale) },
    { key: 'dark_flow', value: attributionPercent(feature_attribution?.dark_flow) },
    { key: 'technical', value: attributionPercent(feature_attribution?.technical) },
  ].filter((row) => row.value != null);
  const attributionLabels = { whale: 'Whale', dark_flow: 'Dark flow', technical: 'Technical' };
  const snapshotEntries = Object.entries(input_snapshot || {}).slice(0, 6);

  const confidence = (() => {
    if (typeof rawConfidence === 'number' && rawConfidence > 0 && rawConfidence <= 1) {
      return Math.round(rawConfidence * 100);
    }
    if (rawConfidence != null) return Number(rawConfidence);
    const match = typeof ai_summary === 'string' && ai_summary.match(/(\d{1,3})%/);
    if (match) return Number(match[1]);
    return null;
  })();

  const isStale = (freshnessSeconds != null && freshnessSeconds > 120) || realtimeStatus === 'idle';

  const confidenceColor = confidence == null
    ? 'text-gray-500'
    : confidence >= 70
      ? 'text-emerald-400'
      : confidence >= 40
        ? 'text-amber-400'
        : 'text-red-400';

  const hasSufficientData = Boolean(ai_summary);

  function handleToggle() {
    if (!hasSufficientData) {
      trackExplainabilityInsufficient(symbol, 'no_ai_summary');
      return;
    }
    const next = !open;
    if (next) trackExplainabilityOpened(symbol);
    setOpen(next);
  }

  return e(
    'div',
    { className: 'rounded-xl border border-slate-800 bg-slate-900/60 text-sm' },
    e(
      'div',
      { className: 'flex items-center justify-between gap-3 px-4 py-3' },
      e(
        'div',
        { className: 'flex items-center gap-2 flex-wrap' },
        e('span', { className: 'font-bold text-slate-100' }, symbol),
        confidence != null && e('span', { className: `text-xs font-semibold ${confidenceColor}` }, `Độ tin cậy ${confidence}%`),
        isStale && e('span', { className: 'text-[11px] bg-amber-900/40 border border-amber-700 text-amber-300 px-1.5 py-0.5 rounded-full' }, 'Dữ liệu cũ — hãy làm mới')
      ),
      e('button', {
        type: 'button',
        onClick: handleToggle,
        className: `text-xs px-3 py-1 rounded-lg border transition-colors ${
          hasSufficientData
            ? 'border-cyan-800 bg-cyan-950/30 text-cyan-400 hover:bg-cyan-950/50'
            : 'border-gray-700 bg-gray-800 text-gray-500 cursor-not-allowed'
        }`,
        title: !hasSufficientData
          ? t('aiAdvisory.explainability.noData', { defaultValue: 'Chưa có phân tích AI' })
          : undefined
      }, open
        ? t('aiAdvisory.explainability.hide', { defaultValue: 'Ẩn lý do' })
        : t('aiAdvisory.explainability.show', { defaultValue: 'Tại sao?' }))
    ),
    open && e(
      'div',
      { className: 'border-t border-slate-800 px-4 py-3 space-y-3' },
      ai_summary && e(
        'div',
        null,
        e('p', { className: 'text-[11px] uppercase tracking-wider text-slate-500 mb-1' }, 'Tổng kết AI'),
        e('p', { className: 'text-xs leading-6 text-slate-300 whitespace-pre-line' }, ai_summary)
      ),
      ai_detail && e(
        'div',
        null,
        e('p', { className: 'text-[11px] uppercase tracking-wider text-slate-500 mb-1' }, 'Phân tích chi tiết'),
        e('p', { className: 'text-xs leading-6 text-slate-400 whitespace-pre-line max-h-48 overflow-y-auto' }, ai_detail)
      ),
      attributionRows.length > 0 && e(
        'div',
        null,
        e('p', { className: 'text-[11px] uppercase tracking-wider text-slate-500 mb-1' }, t('aiAdvisory.explainability.attribution', { defaultValue: 'Đóng góp tín hiệu' })),
        e(
          'div',
          { className: 'grid grid-cols-3 gap-2' },
          attributionRows.map((row) => e(
            'div',
            { key: row.key, className: 'rounded-lg border border-slate-800 bg-slate-950/40 p-2' },
            e('p', { className: 'text-[10px] text-slate-500' }, t(`aiAdvisory.explainability.${row.key}`, { defaultValue: attributionLabels[row.key] })),
            e('p', { className: 'text-sm font-bold text-cyan-400 font-mono' }, `${row.value.toFixed(0)}%`)
          ))
        )
      ),
      snapshotEntries.length > 0 && e(
        'div',
        null,
        e('p', { className: 'text-[11px] uppercase tracking-wider text-slate-500 mb-1' }, t('aiAdvisory.explainability.inputSnapshot', { defaultValue: 'Input snapshot' })),
        e('p', { className: 'text-[11px] text-slate-400 font-mono break-words' }, snapshotEntries.map(([key, value]) => `${key}=${String(value)}`).join(' · '))
      ),
      isStale && e(
        'div',
        {
          role: 'status',
          className: 'rounded-lg border border-amber-800 bg-amber-950/20 px-3 py-2 text-xs text-amber-300',
        },
        t('aiAdvisory.explainability.staleWarning', {
          defaultValue: 'Khuyến nghị này dựa trên dữ liệu cũ. Mức giá và tín hiệu thị trường có thể đã thay đổi.',
        })
      ),
      e(
        'div',
        { className: 'text-[11px] text-slate-600 flex flex-wrap gap-x-3 gap-y-1' },
        e('span', null, `${ai_provider || 'AI'}${ai_model ? ` / ${ai_model}` : ''}`),
        generated_at ? e('span', null, new Date(generated_at).toLocaleString(localeTag)) : null
      )
    )
  );
}

export default RecommendationCardExplainability;