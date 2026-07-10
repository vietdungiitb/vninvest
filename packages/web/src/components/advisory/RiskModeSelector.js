/**
 * RiskModeSelector — Risk mode selector for Whale Advisory
 * Converted from JSX to createElement pattern
 */
import { createElement } from 'react';
import { useTrustTelemetry } from '../../hooks/useTrustTelemetry.js';

const e = createElement;

const MODES = [
  {
    id: 'conservative',
    emoji: '🛡️',
    label: 'Thận trọng',
    desc: 'Ưu tiên bảo toàn vốn. Chỉ hiện khuyến nghị độ tin cậy cao.',
    color: 'border-blue-700 bg-blue-950/30 text-blue-300',
    activeColor: 'border-blue-500 bg-blue-900/50 text-blue-200 ring-1 ring-blue-600',
  },
  {
    id: 'balanced',
    emoji: '⚖️',
    label: 'Cân bằng',
    desc: 'Dung hoà giữa lợi nhuận và rủi ro.',
    color: 'border-emerald-700 bg-emerald-950/30 text-emerald-300',
    activeColor: 'border-emerald-500 bg-emerald-900/50 text-emerald-200 ring-1 ring-emerald-600',
  },
  {
    id: 'aggressive',
    emoji: '🚀',
    label: 'Tăng trưởng',
    desc: 'Chấp nhận rủi ro cao hơn để tối ưu lợi nhuận.',
    color: 'border-rose-700 bg-rose-950/30 text-rose-300',
    activeColor: 'border-rose-500 bg-rose-900/50 text-rose-200 ring-1 ring-rose-600',
  },
];

export function RiskModeSelector({ symbol, value = 'balanced', onChange, disabled = false }) {
  const { trackRiskModeChanged } = useTrustTelemetry();

  function handleSelect(mode) {
    if (disabled || mode === value) return;
    trackRiskModeChanged(symbol, mode);
    onChange?.(mode);
  }

  return e(
    'div',
    { className: 'space-y-2' },
    e('p', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-400' }, 'Khẩu vị rủi ro'),
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
          e('div', { className: 'text-base mb-1' }, mode.emoji),
          e('div', { className: 'text-xs font-semibold' }, mode.label),
          e('div', { className: 'text-[10px] mt-0.5 opacity-70 leading-4' }, mode.desc)
        );
      })
    )
  );
}

export default RiskModeSelector;