import React from 'react';
import { useI18n } from '../../context/LangContext';
import useTrustTelemetry from '../../hooks/useTrustTelemetry';

/**
 * S24-09 — RiskModeSelector
 *
 * A three-way toggle that lets the user declare their risk appetite.
 * The selected mode is emitted via useTrustTelemetry and surfaced to the parent
 * via onChange so it can gate recommendation visibility or add disclaimers.
 *
 * Props:
 *   symbol    – ticker string (for telemetry)
 *   value     – current mode: 'conservative' | 'balanced' | 'aggressive'
 *   onChange  – callback(mode: string)
 *   disabled  – boolean
 */

const MODES = [
  {
    id: 'conservative',
    emoji: '🛡️',
    labelKey: 'riskMode.conservative',
    defaultLabel: 'Thận trọng',
    descKey: 'riskMode.conservativeDesc',
    defaultDesc: 'Ưu tiên bảo toàn vốn. Chỉ hiện khuyến nghị độ tin cậy cao.',
    color: 'border-blue-700 bg-blue-950/30 text-blue-300',
    activeColor: 'border-blue-500 bg-blue-900/50 text-blue-200 ring-1 ring-blue-600',
  },
  {
    id: 'balanced',
    emoji: '⚖️',
    labelKey: 'riskMode.balanced',
    defaultLabel: 'Cân bằng',
    descKey: 'riskMode.balancedDesc',
    defaultDesc: 'Dung hoà giữa lợi nhuận và rủi ro.',
    color: 'border-emerald-700 bg-emerald-950/30 text-emerald-300',
    activeColor: 'border-emerald-500 bg-emerald-900/50 text-emerald-200 ring-1 ring-emerald-600',
  },
  {
    id: 'aggressive',
    emoji: '🚀',
    labelKey: 'riskMode.aggressive',
    defaultLabel: 'Tăng trưởng',
    descKey: 'riskMode.aggressiveDesc',
    defaultDesc: 'Chấp nhận rủi ro cao hơn để tối ưu lợi nhuận.',
    color: 'border-rose-700 bg-rose-950/30 text-rose-300',
    activeColor: 'border-rose-500 bg-rose-900/50 text-rose-200 ring-1 ring-rose-600',
  },
];

export default function RiskModeSelector({ symbol, value = 'balanced', onChange, disabled = false }) {
  const { t } = useI18n();
  const { trackRiskModeChanged } = useTrustTelemetry();

  function handleSelect(mode) {
    if (disabled || mode === value) return;
    trackRiskModeChanged(symbol, mode);
    onChange?.(mode);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {t('riskMode.title', { defaultValue: 'Khẩu vị rủi ro' })}
      </p>
      <div className="flex flex-col gap-2">
        {MODES.map((mode) => {
          const isActive = value === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => handleSelect(mode.id)}
              disabled={disabled}
              className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:brightness-110'
              } ${isActive ? mode.activeColor : mode.color}`}
            >
              <div className="text-base mb-1">{mode.emoji}</div>
              <div className="text-xs font-semibold">
                {t(mode.labelKey, { defaultValue: mode.defaultLabel })}
              </div>
              <div className="text-[10px] mt-0.5 opacity-70 leading-4">
                {t(mode.descKey, { defaultValue: mode.defaultDesc })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
