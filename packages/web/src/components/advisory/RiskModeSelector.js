/**
 * RiskModeSelector — Risk mode selector for Whale Advisory
 * Converted from JSX to createElement pattern
 */
import { createElement } from 'react';
import { useI18n } from '../../context/LangContext.js';
import { useTrustTelemetry } from '../../hooks/useTrustTelemetry.js';

const e = createElement;

/*
 * Màu rủi ro — sửa lỗi contrast ở light mode.
 *
 * Bằng chứng (2026-09-26, ảnh `advisory-light-data.png`): "Thận trọng" và
 * "Tăng trưởng" gần như không đọc được. Nguyên nhân: bảng màu gốc dùng nền
 * `-950` (gần đen) + chữ `-300`/`-200` (rất sáng), tức thiết kế cho dark mode
 * ONLY. Ở light mode `bg-blue-950/30` = 30% navy đè lên trang trắng → thành
 * xám xanh nhạt, trong khi `text-blue-300` vẫn là xanh rất sáng → chữ sáng
 * trên nền sáng. Đây là lỗi WCAG AA, không phải lỗi thẩm mỹ.
 *
 * Cách sửa: đặt màu light làm mặc định (không tiền tố) và màu cũ nằm sau
 * `dark:`. App định nghĩa `@custom-variant dark` là
 * `:root:not([data-theme="light"] *)` — nên `dark:` đúng nghĩa là "chỉ khi
 * KHÔNG phải light", khớp với cách app bật theme (`main.tsx:175-180`).
 */
const MODES = [
  {
    id: 'conservative',
    labelKey: 'aiAdvisory.risk.conservative',
    descriptionKey: 'aiAdvisory.risk.conservativeDesc',
    defaultLabel: 'Thận trọng',
    defaultDescription: 'Ưu tiên bảo toàn vốn. Chỉ hiện khuyến nghị độ tin cậy cao.',
    color: 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300',
    activeColor: 'border-blue-500 bg-blue-100 text-blue-950 ring-1 ring-blue-500 dark:border-blue-500 dark:bg-blue-900/50 dark:text-blue-200 dark:ring-blue-600',
  },
  {
    id: 'balanced',
    labelKey: 'aiAdvisory.risk.balanced',
    descriptionKey: 'aiAdvisory.risk.balancedDesc',
    defaultLabel: 'Cân bằng',
    defaultDescription: 'Dung hoà giữa lợi nhuận và rủi ro.',
    color: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
    activeColor: 'border-emerald-500 bg-emerald-100 text-emerald-950 ring-1 ring-emerald-500 dark:border-emerald-500 dark:bg-emerald-900/50 dark:text-emerald-200 dark:ring-emerald-600',
  },
  {
    id: 'aggressive',
    labelKey: 'aiAdvisory.risk.aggressive',
    descriptionKey: 'aiAdvisory.risk.aggressiveDesc',
    defaultLabel: 'Tăng trưởng',
    defaultDescription: 'Chấp nhận rủi ro cao hơn để tối ưu lợi nhuận.',
    color: 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-300',
    activeColor: 'border-rose-500 bg-rose-100 text-rose-950 ring-1 ring-rose-500 dark:border-rose-500 dark:bg-rose-900/50 dark:text-rose-200 dark:ring-rose-600',
  },
];

export function RiskModeSelector({ symbol, value = 'balanced', onChange, disabled = false }) {
  const { t } = useI18n();
  const { trackRiskModeChanged } = useTrustTelemetry();

  function handleSelect(mode) {
    if (disabled || mode === value) return;
    trackRiskModeChanged(symbol, mode);
    onChange?.(mode);
  }

  return e(
    'div',
    { className: 'space-y-2' },
    e('p', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-400' }, t('aiAdvisory.risk.title', { defaultValue: 'Khẩu vị rủi ro' })),
    e(
      'div',
      { className: 'flex flex-col gap-2' },
      MODES.map((mode) => {
        const isActive = value === mode.id;
        return e(
          'button',
          {
            key: mode.id,
            type: 'button',
            onClick: () => handleSelect(mode.id),
            disabled: disabled,
            className: `rounded-xl border px-3 py-2.5 text-left transition-all ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:brightness-110'} ${isActive ? mode.activeColor : mode.color}`
          },
          e('div', { className: 'text-xs font-semibold' }, t(mode.labelKey, { defaultValue: mode.defaultLabel })),
          e('div', { className: 'text-[10px] mt-0.5 opacity-70 leading-4' }, t(mode.descriptionKey, { defaultValue: mode.defaultDescription }))
        );
      })
    )
  );
}

export default RiskModeSelector;