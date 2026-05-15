/**
 * Service Health Status Card — displays health status with color coding
 * Tailwind dark theme (slate-950 base)
 */
import PropTypes from 'prop-types';

// Status -> Tailwind color map
const STATUS_COLORS = {
  healthy: {
    card: 'border-emerald-700 bg-emerald-950/30',
    label: 'text-emerald-300',
    badge: 'bg-emerald-900 text-emerald-200',
  },
  degraded: {
    card: 'border-amber-700 bg-amber-950/30',
    label: 'text-amber-300',
    badge: 'bg-amber-900 text-amber-200',
  },
  unhealthy: {
    card: 'border-rose-700 bg-rose-950/30',
    label: 'text-rose-300',
    badge: 'bg-rose-900 text-rose-200',
  },
  unknown: {
    card: 'border-slate-700 bg-slate-800',
    label: 'text-slate-300',
    badge: 'bg-slate-700 text-slate-200',
  },
  maintenance: {
    card: 'border-sky-700 bg-sky-950/30',
    label: 'text-sky-300',
    badge: 'bg-sky-900 text-sky-200',
  },
};

const STATUS_TEXT_KEYS = {
  healthy: 'soc.health.status_healthy',
  degraded: 'soc.health.status_degraded',
  unhealthy: 'soc.health.status_critical',
  unknown: 'soc.health.status_unknown',
  maintenance: 'soc.health.status_maintenance',
};

export const ServiceHealthCard = ({ service, health, t }) => {
  const status = health?.status || 'unknown';
  const colors = STATUS_COLORS[status] || STATUS_COLORS.unknown;
  const lastCheckAt = health?.last_check_at || health?.last_success_at || health?.updated_at;
  const latency = typeof health?.avg_response_ms === 'number' ? health.avg_response_ms : null;

  return (
    <div className={`rounded-lg border p-4 ${colors.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-white">{service.name}</h3>
          <p className="mt-1 text-xs text-slate-400">
            {service.service_key}
            {service.domain ? ` • ${service.domain}` : ''}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${colors.badge}`}>
          {t(STATUS_TEXT_KEYS[status] || STATUS_TEXT_KEYS.unknown)}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-md bg-slate-950/40 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">{t('soc.health.status_label')}</p>
          <p className={`mt-1 text-sm font-semibold ${colors.label}`}>
            {t(STATUS_TEXT_KEYS[status] || STATUS_TEXT_KEYS.unknown)}
          </p>
        </div>
        <div className="rounded-md bg-slate-950/40 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">{t('soc.health.latency_label')}</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {latency === null ? t('soc.health.unknown_value') : `${latency.toFixed(0)}ms`}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-md bg-slate-950/40 p-3">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{t('soc.health.last_check_label')}</p>
        <p className="mt-1 truncate text-sm text-slate-200">{lastCheckAt || t('soc.health.unknown_value')}</p>
      </div>
    </div>
  );
};

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
ServiceHealthCard.propTypes = {
  service: PropTypes.shape({
    name: PropTypes.string.isRequired,
    service_key: PropTypes.string.isRequired,
    domain: PropTypes.string,
  }).isRequired,
  health: PropTypes.shape({
    status: PropTypes.string.isRequired,
    avg_response_ms: PropTypes.number,
    last_check_at: PropTypes.string,
    last_success_at: PropTypes.string,
    updated_at: PropTypes.string,
  }).isRequired,
  t: PropTypes.func.isRequired,
};
