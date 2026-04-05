import React, { useState } from 'react';
import { useI18n } from '../../context/LangContext';
import useTrustTelemetry from '../../hooks/useTrustTelemetry';

/**
 * S24-08 — ActionChecklist
 *
 * A pre-trade checklist that nudges the user to review key risk factors
 * before acting on a recommendation. Requires all items to be checked
 * before the "Tiến hành" CTA becomes available.
 *
 * Props:
 *   symbol          – ticker string shown in telemetry
 *   isBlocked       – boolean: if true show blocked state (staleness / low confidence)
 *   blockedReason   – string: reason shown when blocked
 *   onProceed       – callback fired when user clicks the proceed button
 *   items           – optional override checklist items array [{ id, label }]
 */

const DEFAULT_ITEMS = [
  { id: 'reviewed_risk', label: 'Đã xem xét mức độ rủi ro của khuyến nghị' },
  { id: 'reviewed_history', label: 'Đã xem lịch sử kết quả của AI tư vấn' },
  { id: 'market_conditions', label: 'Đã kiểm tra điều kiện thị trường hiện tại' },
  { id: 'own_analysis', label: 'Phân tích của tôi đồng thuận với khuyến nghị này' },
];

export default function ActionChecklist({
  symbol,
  isBlocked = false,
  blockedReason = '',
  onProceed = null,
  items = DEFAULT_ITEMS,
}) {
  const { t } = useI18n();
  const [checked, setChecked] = useState(() => Object.fromEntries(items.map((item) => [item.id, false])));
  const [proceeded, setProceeded] = useState(false);
  const {
    trackActionChecklistCompleted,
    trackActionAttemptBlocked,
  } = useTrustTelemetry();

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

  const resolvedItems = items.map((item) => ({
    ...item,
    label: t(`actionChecklist.${item.id}`, { defaultValue: item.label }),
  }));

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {t('actionChecklist.title', { defaultValue: 'Danh sách kiểm tra trước khi hành động' })}
      </p>

      {isBlocked && (
        <div className="rounded-lg border border-red-800 bg-red-950/20 px-3 py-2 text-xs text-red-300 flex items-start gap-2">
          <span className="mt-0.5">🚫</span>
          <span>
            {blockedReason
              || t('actionChecklist.blockedDefault', { defaultValue: 'Dữ liệu không đủ tin cậy để tiến hành. Hãy làm mới và xem lại khuyến nghị.' })}
          </span>
        </div>
      )}

      <ul className="space-y-2">
        {resolvedItems.map((item) => (
          <li key={item.id}>
            <label className={`flex items-start gap-2.5 cursor-pointer ${isBlocked ? 'opacity-50 pointer-events-none' : ''}`}>
              <input
                type="checkbox"
                checked={checked[item.id] || false}
                onChange={() => handleToggle(item.id)}
                className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 accent-cyan-500 cursor-pointer"
              />
              <span className={`text-xs leading-5 ${checked[item.id] ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                {item.label}
              </span>
            </label>
          </li>
        ))}
      </ul>

      {proceeded ? (
        <div className="flex items-center gap-2 text-xs text-emerald-400">
          <span>✓</span>
          <span>{t('actionChecklist.proceedConfirmed', { defaultValue: 'Ghi nhận — hành động của bạn đã được log.' })}</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleProceed}
          disabled={!allChecked || isBlocked}
          className={`w-full py-2 rounded-lg text-xs font-semibold transition-colors ${
            allChecked && !isBlocked
              ? 'bg-cyan-700 hover:bg-cyan-600 text-white'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          {isBlocked
            ? t('actionChecklist.blocked', { defaultValue: '🚫 Bị khóa — dữ liệu chưa đủ tin cậy' })
            : allChecked
              ? t('actionChecklist.proceed', { defaultValue: '✓ Tiến hành' })
              : t('actionChecklist.checkAllFirst', {
                  count: items.length - Object.values(checked).filter(Boolean).length,
                  defaultValue: `Cần tích ${items.length - Object.values(checked).filter(Boolean).length} mục nữa`,
                })}
        </button>
      )}
    </div>
  );
}
