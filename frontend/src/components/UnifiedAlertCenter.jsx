import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../context/LangContext';
import { normalizeSeverity } from '../hooks/useUnifiedAlerts';
import PaginationBar from './shared/PaginationBar';

function SummaryChip({ label, count, tone, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`v2-chip-focus rounded-md border px-3 py-1.5 text-left transition-all duration-150 hover:-translate-y-[1px] hover:brightness-110 ${tone} ${active ? 'ring-1 ring-offset-0 ring-white/30' : ''}`}
    >
      <p className="text-[10px] uppercase tracking-[0.12em] opacity-85">{label}</p>
      <p className="mt-0.5 text-[18px] font-bold leading-none tabular-nums">{count}</p>
    </button>
  );
}

function sourceTone(source) {
  if (source === 'whale') return 'border-cyan-700/80 bg-cyan-950/40 text-cyan-200';
  if (source === 'dark_flow') return 'border-violet-700/80 bg-violet-950/35 text-violet-200';
  if (source === 'price_shock') return 'border-amber-700/80 bg-amber-950/35 text-amber-200';
  return 'border-slate-700 bg-slate-900 text-slate-300';
}

function sourceLabel(source, t) {
  if (source === 'whale') return t('dashboardRealtime.sourceWhale');
  if (source === 'dark_flow') return t('dashboardRealtime.sourceDarkFlow');
  if (source === 'price_shock') return t('dashboardRealtime.sourcePriceShock');
  return t('dashboardRealtime.sourceStaleQuote');
}

function severityTone(severity) {
  if (severity === 'critical') return 'border-rose-600/70 bg-rose-950/45 text-rose-200';
  if (severity === 'high') return 'border-amber-600/70 bg-amber-950/35 text-amber-200';
  if (severity === 'medium') return 'border-cyan-700/70 bg-cyan-950/25 text-cyan-200';
  return 'border-slate-700 bg-slate-900 text-slate-300';
}

export default function UnifiedAlertCenter({
  alerts,
  alertSummary,
  readAlertIds,
  markAlertAsRead,
  muteSymbolFor30m,
  severityFilter,
  setSeverityFilter,
  onSeverityFilterChange,
  criticalSoundEnabled,
  toggleCriticalSound,
  currentUnifiedPage,
  hasPreviousUnifiedPage,
  backendUnifiedHasMore,
  loadingMoreUnified,
  goToFirstUnifiedPage,
  goToPreviousUnifiedPage,
  goToNextUnifiedPage,
  goToLastUnifiedPage,
  hasLastUnifiedPage,
  pageSize,
  setPageSize,
  sourceFilter,
  setSourceFilter,
  audienceFilter,
  setAudienceFilter,
  unreadCount,
  showSummaryChips = false,
  minHeightClass = 'min-h-[580px]',
  className = '',
}) {
  const { t, formatDateTime, formatNumber } = useI18n();
  const [activeWorkspaceTab, setActiveWorkspaceTab] = React.useState('alerts');
  const safeAlerts = React.useMemo(() => (Array.isArray(alerts) ? alerts : []), [alerts]);
  const unreadAlertCount = unreadCount ?? safeAlerts.filter((item) => !readAlertIds.has(item.id)).length;

  const severityFilters = [
    { value: 'all', label: t('dashboardRealtime.filterAll') },
    { value: 'critical', label: t('dashboardRealtime.severityCritical') },
    { value: 'high_only', label: t('dashboardRealtime.severityHigh') },
    { value: 'medium_only', label: t('dashboardRealtime.severityMedium') },
    { value: 'low_only', label: t('dashboardRealtime.severityLow') },
    { value: 'critical_only', label: t('dashboardRealtime.filterCriticalOnly') },
    { value: 'high_plus', label: t('dashboardRealtime.filterHighPlus') },
    { value: 'medium_plus', label: t('dashboardRealtime.filterMediumPlus') },
  ];

  return (
    <section className={`v2-panel flex ${minHeightClass} flex-col rounded-xl ${className}`.trim()}>
      <div className="border-b border-slate-800/90 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-200">
              {activeWorkspaceTab === 'settings' ? t('dashboardRealtime.settingsPanelTitle') : t('dashboardRealtime.unifiedCenterTitle')}
            </h3>
            <p className="mt-1 text-[11px] text-slate-500">
              {activeWorkspaceTab === 'settings' ? t('dashboardRealtime.settingsPanelHint') : t('dashboardRealtime.unifiedCenterHint')}
            </p>
          </div>
          {activeWorkspaceTab === 'alerts' ? (
            <Link to="/whale-alerts" className="text-xs text-cyan-400 transition-colors hover:text-cyan-300">
              {t('dashboardRealtime.viewAll')}
            </Link>
          ) : (
            <span className="text-sm font-semibold text-amber-300">
              {t('dashboardRealtime.unreadAlerts', { count: formatNumber(unreadAlertCount) })}
            </span>
          )}
        </div>

        {showSummaryChips && activeWorkspaceTab === 'alerts' && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryChip
              label={t('dashboardRealtime.severityCritical')}
              count={formatNumber(alertSummary?.critical || 0)}
              tone="border-rose-700/70 bg-rose-950/35 text-rose-200"
              active={severityFilter === 'critical_only'}
              onClick={() => (onSeverityFilterChange ? onSeverityFilterChange('critical_only') : setSeverityFilter('critical_only'))}
            />
            <SummaryChip
              label={t('dashboardRealtime.severityHigh')}
              count={formatNumber(alertSummary?.high || 0)}
              tone="border-amber-700/70 bg-amber-950/30 text-amber-200"
              active={severityFilter === 'high_only'}
              onClick={() => (onSeverityFilterChange ? onSeverityFilterChange('high_only') : setSeverityFilter('high_only'))}
            />
            <SummaryChip
              label={t('dashboardRealtime.severityMedium')}
              count={formatNumber(alertSummary?.medium || 0)}
              tone="border-cyan-700/70 bg-cyan-950/25 text-cyan-200"
              active={severityFilter === 'medium_only'}
              onClick={() => (onSeverityFilterChange ? onSeverityFilterChange('medium_only') : setSeverityFilter('medium_only'))}
            />
            <SummaryChip
              label={t('dashboardRealtime.severityLow')}
              count={formatNumber(alertSummary?.low || 0)}
              tone="border-slate-700 bg-slate-900 text-slate-300"
              active={severityFilter === 'low_only'}
              onClick={() => (onSeverityFilterChange ? onSeverityFilterChange('low_only') : setSeverityFilter('low_only'))}
            />
          </div>
        )}

        <div className="mt-3 inline-flex rounded-lg border border-slate-700 bg-slate-950/70 p-1 text-[11px]">
          <button
            type="button"
            onClick={() => setActiveWorkspaceTab('alerts')}
            className={`rounded-md px-3 py-1.5 font-semibold transition-colors ${activeWorkspaceTab === 'alerts'
              ? 'bg-cyan-900/35 text-cyan-200'
              : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t('dashboardRealtime.workspaceTabAlerts')}
          </button>
          <button
            type="button"
            onClick={() => setActiveWorkspaceTab('settings')}
            className={`rounded-md px-3 py-1.5 font-semibold transition-colors ${activeWorkspaceTab === 'settings'
              ? 'bg-cyan-900/35 text-cyan-200'
              : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t('dashboardRealtime.workspaceTabSettings')}
          </button>
        </div>

      </div>

      {activeWorkspaceTab === 'alerts' ? (
        <>
          <div className="panel-scrollbar flex-1 overflow-y-auto px-3 py-3">
            {safeAlerts.length === 0 ? (
              <div className="flex flex-col h-full items-center justify-center py-20 text-sm text-slate-500">
                <div className="text-3xl mb-4 text-slate-700 opacity-50">📡</div>
                {t('dashboardRealtime.noUnifiedAlerts')}
              </div>
            ) : (
              <div className="space-y-2.5 pb-10">
                {safeAlerts.map((alert, index) => {
                  const severity = normalizeSeverity(alert.severity, 'medium');
                  const isUnread = !readAlertIds.has(alert.id);
                  return (
                    <Link
                      key={alert.id || `${alert.symbol}-${alert.ts}-${index}`}
                      to={alert.to || `/stocks/${alert.symbol}`}
                      className="block"
                    >
                      <div className={`rounded-xl border px-3 py-2.5 shadow-[inset_0_1px_0_rgba(148,163,184,0.08)] transition-all duration-150 hover:-translate-y-[1px] hover:shadow-lg ${severityTone(severity)}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[14px] font-black tracking-wide text-white">{alert.symbol || 'N/A'}</span>
                          <div className="flex items-center gap-2">
                            {isUnread && (
                              <span className="rounded-full border border-cyan-700/70 bg-cyan-950/35 px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-200">
                                {t('dashboardRealtime.badgeNew')}
                              </span>
                            )}
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${sourceTone(alert.source)}`}>
                              {sourceLabel(alert.source, t)}
                            </span>
                          </div>
                        </div>

                        <div className="mt-1 flex items-baseline justify-between gap-2">
                          <span className="text-sm font-bold leading-snug text-white">{alert.headline}</span>
                          <span className="text-[11px] text-slate-400">
                            {formatDateTime(alert.ts, {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>

                        <div className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{alert.detail}</div>
                        {alert.confidence != null && (
                          <div className="mt-1 text-[11px] text-slate-400">
                            {t('dashboardRealtime.confidence')}: {formatNumber(Number(alert.confidence) || 0)}
                          </div>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              markAlertAsRead(alert.id);
                            }}
                            className="v2-chip-focus rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:border-slate-600 hover:text-slate-100"
                          >
                            {t('dashboardRealtime.markRead')}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              muteSymbolFor30m(alert.symbol);
                            }}
                            className="v2-chip-focus rounded border border-amber-700/70 bg-amber-950/25 px-2 py-1 text-[10px] font-semibold text-amber-200 hover:bg-amber-900/35"
                          >
                            {t('dashboardRealtime.mute30m')}
                          </button>
                        </div>
                      </div>
                    </Link>
                  );
                })}

              </div>
            )}
          </div>

          <PaginationBar
            mode="cursor"
            currentPage={currentUnifiedPage || 1}
            hasPrev={hasPreviousUnifiedPage}
            hasNext={backendUnifiedHasMore}
            hasLast={hasLastUnifiedPage}
            loading={loadingMoreUnified}
            onFirst={goToFirstUnifiedPage}
            onPrev={goToPreviousUnifiedPage}
            onNext={goToNextUnifiedPage}
            onLast={goToLastUnifiedPage}
            pageSize={pageSize}
            onSizeChange={setPageSize}
          />
        </>
      ) : (
        <div className="panel-scrollbar flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-slate-500">{t('dashboardRealtime.filterBySource')}</span>
              {['all', 'whale', 'dark_flow', 'price_shock', 'stale_quote'].map((source) => (
                <button
                  key={source}
                  type="button"
                  onClick={() => setSourceFilter(source)}
                  className={`v2-chip-focus rounded-full border px-2.5 py-1 font-semibold transition-colors ${sourceFilter === source
                    ? 'border-cyan-600 bg-cyan-900/30 text-cyan-200'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                  }`}
                >
                  {source === 'all' ? t('dashboardRealtime.filterAll') : sourceLabel(source, t)}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-slate-500">{t('dashboardRealtime.filterByAudience')}</span>
              {[
                { value: 'all', label: t('dashboardRealtime.filterAll') },
                { value: 'holdings', label: t('dashboardRealtime.filterHoldingsOnly') },
                { value: 'watchlist', label: t('dashboardRealtime.filterWatchlistOnly') },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setAudienceFilter(item.value)}
                  className={`v2-chip-focus rounded-full border px-2.5 py-1 font-semibold transition-colors ${audienceFilter === item.value
                    ? 'border-cyan-600 bg-cyan-900/30 text-cyan-200'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-slate-500">{t('dashboardRealtime.filterBySeverity')}</span>
              {severityFilters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setSeverityFilter(item.value)}
                  className={`v2-chip-focus rounded-full border px-2.5 py-1 font-semibold transition-colors ${severityFilter === item.value
                    ? 'border-cyan-600 bg-cyan-900/30 text-cyan-200'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-slate-500">{t('dashboardRealtime.criticalToastPolicy')}</span>
              <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 font-semibold text-slate-400">
                {t('dashboardRealtime.toastQueuePolicy')}
              </span>
              <button
                type="button"
                onClick={toggleCriticalSound}
                className={`v2-chip-focus rounded-full border px-2.5 py-1 font-semibold transition-colors ${criticalSoundEnabled
                  ? 'border-cyan-600 bg-cyan-900/30 text-cyan-200'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                }`}
              >
                {criticalSoundEnabled ? t('dashboardRealtime.soundOn') : t('dashboardRealtime.soundOff')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
