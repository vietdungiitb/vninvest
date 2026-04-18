import React, { useEffect, useState } from 'react';
import { useI18n } from '../context/LangContext';

const SOURCES_METADATA = {
  whale: { lookback: 180, unit: 'day' },
  dark_flow: { lookback: 90, unit: 'day' },
  technical: { lookback: 30, unit: 'session', indicators: true },
  news: { lookback: 14, unit: 'day' },
  market: { lookback: 7, unit: 'day' },
  fundamental: { lookback: 1, unit: 'quarter' },
  ownership: { lookback: 365, unit: 'day' },
  sector: { lookback: 60, unit: 'session' },
};

const TECHNICAL_INDICATORS = ['rsi', 'bollinger', 'vols', 'prices', 'ma20', 'ma50', 'snapshot', 'cdms'];

export default function AIAdvisoryPromptConfigDrawer({ isOpen, onClose, config, onConfigChange }) {
  const { t } = useI18n();
  const [localConfig, setLocalConfig] = useState(config);

  const sourceLabelById = {
    whale: t('stockDetail.promptSourceWhale', { defaultValue: 'Whale Alerts' }),
    dark_flow: t('stockDetail.promptSourceDarkFlow', { defaultValue: 'Dark Money Flow' }),
    technical: t('stockDetail.promptSourceTechnical', { defaultValue: 'Technical Analysis' }),
    news: t('stockDetail.promptSourceNews', { defaultValue: 'News Context' }),
    market: t('stockDetail.promptSourceMarket', { defaultValue: 'Market Context' }),
    fundamental: t('stockDetail.promptSourceFundamental', { defaultValue: 'Fundamental' }),
    ownership: t('stockDetail.promptSourceOwnership', { defaultValue: 'Ownership/Insider' }),
    sector: t('stockDetail.promptSourceSector', { defaultValue: 'Sector Comparison' }),
  };

  useEffect(() => {
    setLocalConfig(config);
  }, [config, isOpen]);

  if (!isOpen) return null;

  const handleSourceToggle = (sourceId) => {
    const updated = {
      ...localConfig,
      sources: {
        ...localConfig.sources,
        [sourceId]: {
          ...localConfig.sources[sourceId],
          enabled: !localConfig.sources[sourceId].enabled,
        },
      },
    };
    setLocalConfig(updated);
    onConfigChange(updated);
  };

  const handleIndicatorToggle = (indicator) => {
    const currentIndicators = localConfig.sources.technical.indicators || [];
    const updated = {
      ...localConfig,
      sources: {
        ...localConfig.sources,
        technical: {
          ...localConfig.sources.technical,
          indicators: currentIndicators.includes(indicator)
            ? currentIndicators.filter((ind) => ind !== indicator)
            : [...currentIndicators, indicator],
        },
      },
    };
    setLocalConfig(updated);
    onConfigChange(updated);
  };

  const enabledSources = Object.entries(localConfig.sources)
    .filter(([_, cfg]) => cfg.enabled)
    .map(([id]) => id)
    .length;

  const enabledIndicators = (localConfig.sources.technical.indicators || []).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative max-h-screen w-full max-w-2xl overflow-y-auto rounded-lg bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 border-b border-slate-700 bg-slate-900 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">
              {t('stockDetail.advisorySynthesisSettings', { defaultValue: 'AI Advisory Settings' })}
            </h2>
            <button
              onClick={onClose}
              className="rounded-full p-1 hover:bg-slate-800 focus:outline-none"
            >
              <svg className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {t('stockDetail.advisorySynthesisSettingsDesc', {
              count: enabledSources,
              defaultValue: `Choose which data sources to include in the synthesis (${enabledSources} enabled)`,
            })}
          </p>
        </div>

        {/* Content */}
        <div className="space-y-6 px-6 py-4">
          {/* Default Sources Section */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-slate-300">
              {t('stockDetail.advisorySources', { defaultValue: 'Data Sources' })}
            </h3>
            <div className="grid gap-3">
              {Object.entries(SOURCES_METADATA).map(([sourceId, meta]) => {
                const isEnabled = localConfig.sources[sourceId]?.enabled || false;
                const isDefault = ['whale', 'dark_flow', 'technical', 'news', 'market'].includes(sourceId);

                return (
                  <div
                    key={sourceId}
                    className={`flex items-start gap-3 rounded-lg border p-3 transition ${
                      isEnabled
                        ? 'border-emerald-600/40 bg-emerald-950/20'
                        : 'border-slate-700 bg-slate-800/30'
                    } ${!isDefault ? 'opacity-80' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => handleSourceToggle(sourceId)}
                      className="mt-1 h-4 w-4 accent-emerald-500"
                    />
                    <div className="flex-1">
                      <label className="text-sm font-medium text-slate-100 cursor-pointer">
                        {sourceLabelById[sourceId] || sourceId}
                      </label>
                      {meta.indicators ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {TECHNICAL_INDICATORS.map((ind) => {
                            const isSelected = (localConfig.sources.technical.indicators || []).includes(ind);
                            return (
                              <button
                                key={ind}
                                onClick={() => handleIndicatorToggle(ind)}
                                disabled={!isEnabled}
                                className={`rounded-full px-2 py-1 text-xs font-medium transition ${
                                  isSelected && isEnabled
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                } ${!isEnabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                              >
                                {ind}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-slate-400">
                          {t('stockDetail.promptLookback', {
                            value: meta.lookback,
                            unit: meta.unit,
                            defaultValue: `Lookback: ${meta.lookback} ${meta.unit}`,
                          })}
                          {!isDefault && ` (${t('stockDetail.promptOptional', { defaultValue: 'optional' })})`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="border-t border-slate-700 pt-4">
            <p className="text-xs text-slate-400">
              {t('stockDetail.promptConfigSummary', {
                sources: enabledSources,
                indicators: enabledIndicators,
                defaultValue: `${enabledSources} sources enabled • ${enabledIndicators} indicators selected`,
              })}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-slate-700 bg-slate-900 px-6 py-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition"
          >
            {t('stockDetail.close', { defaultValue: 'Close' })}
          </button>
        </div>
      </div>
    </div>
  );
}
