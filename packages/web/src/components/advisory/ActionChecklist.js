/**
 * ActionChecklist — Action checklist for Whale Advisory
 * Converted from JSX to createElement pattern
 */
import { createElement, useState } from 'react';
import { useI18n } from '../../context/LangContext.js';
import { useTrustTelemetry } from '../../hooks/useTrustTelemetry.js';

const e = createElement;

const DEFAULT_ITEMS = [
  { id: 'reviewed_risk', labelKey: 'aiAdvisory.checklist.risk', defaultLabel: 'Đã xem xét mức độ rủi ro của khuyến nghị' },
  { id: 'reviewed_history', labelKey: 'aiAdvisory.checklist.history', defaultLabel: 'Đã xem lịch sử kết quả của AI tư vấn' },
  { id: 'market_conditions', labelKey: 'aiAdvisory.checklist.market', defaultLabel: 'Đã kiểm tra điều kiện thị trường hiện tại' },
  { id: 'own_analysis', labelKey: 'aiAdvisory.checklist.analysis', defaultLabel: 'Phân tích của tôi đồng thuận với khuyến nghị này' },
];

export function ActionChecklist({
  symbol,
  isBlocked = false,
  blockedReason = '',
  onProceed = null,
  items = DEFAULT_ITEMS,
}) {
  const [checked, setChecked] = useState(() => Object.fromEntries(items.map((item) => [item.id, false])));
  const [proceeded, setProceeded] = useState(false);
  const { t } = useI18n();
  const { trackActionChecklistCompleted, trackActionAttemptBlocked } = useTrustTelemetry();

  const allChecked = items.every((item) => checked[item.id]);

  function handleToggle(id) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleProceed() {
    if (isBlocked) {
      trackActionAttemptBlocked(symbol, blockedReason || 'unknown');
      return;
    }
    if (!allChecked) return;
    trackActionChecklistCompleted(symbol);
    setProceeded(true);
    onProceed?.();
  }

  return e(
    'div',
    { className: 'rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 text-sm' },
    e('p', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-400' }, t('aiAdvisory.checklist.title', { defaultValue: 'Danh sách kiểm tra trước khi hành động' })),
    isBlocked && e(
      'div',
      { role: 'status', className: 'rounded-lg border border-red-800 bg-red-950/20 px-3 py-2 text-xs text-red-300 flex items-start gap-2' },
      e('span', { className: 'mt-0.5' }, '!'),
      e('span', null, blockedReason || t('aiAdvisory.checklist.blockedReason', {
        defaultValue: 'Dữ liệu không đủ tin cậy để tiến hành. Hãy làm mới và xem lại khuyến nghị.',
      }))
    ),
    e(
      'ul',
      { className: 'space-y-2' },
      items.map((item) => e(
        'li',
        { key: item.id },
        e('label', {
          className: `flex items-start gap-2.5 cursor-pointer ${isBlocked ? 'opacity-50 pointer-events-none' : ''}`
        },
          e('input', {
            type: 'checkbox',
            checked: checked[item.id] || false,
            onChange: () => handleToggle(item.id),
            className: 'mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 accent-cyan-500 cursor-pointer'
          }),
          e('span', { className: `text-xs leading-5 ${checked[item.id] ? 'line-through text-slate-500' : 'text-slate-300'}` }, item.label || t(item.labelKey, { defaultValue: item.defaultLabel }))
        )
      ))
    ),
    proceeded ? e(
      'div',
      { className: 'flex items-center gap-2 text-xs text-emerald-400' },
      e('span', null, '✓'),
      e('span', null, t('aiAdvisory.checklist.logged', { defaultValue: 'Ghi nhận — hành động của bạn đã được log.' }))
    ) : e(
      'button',
      {
        type: 'button',
        onClick: handleProceed,
        disabled: !allChecked || isBlocked,
        className: `w-full py-2 rounded-lg text-xs font-semibold transition-colors ${
          allChecked && !isBlocked ? 'bg-cyan-700 hover:bg-cyan-600 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
        }`
      },
      isBlocked ? 'Bị khóa — dữ liệu chưa đủ tin cậy' : allChecked ? '✓ Tiến hành' : t('aiAdvisory.checklist.remaining', { count: items.length - Object.values(checked).filter(Boolean).length, defaultValue: `Cần tích ${items.length - Object.values(checked).filter(Boolean).length} mục nữa` })
    )
  );
}

export default ActionChecklist;