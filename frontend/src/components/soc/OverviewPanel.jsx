/**
 * OverviewPanel.jsx — Service overview with health grid and config status
 */
import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { socApi } from '../../api/socApi';
import { ServiceHealthCard } from './ServiceHealthCard';

const OverviewPanel = ({ t, services }) => {
  const [healthByServiceKey, setHealthByServiceKey] = useState({});
  const [overviewSummary, setOverviewSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const healthStatus = await socApi.getOverviewSummary();
        const nextHealthMap = Object.fromEntries(
          (healthStatus.services || []).map((health) => [health.service_key, health])
        );
        setOverviewSummary(healthStatus);
        setHealthByServiceKey(nextHealthMap);
      } catch (err) {
        console.error('Failed to fetch service health:', err);
      } finally {
        setLoading(false);
      }
    };

    if (services.length > 0) {
      fetchOverview();
    } else {
      setLoading(false);
    }
  }, [services]);

  const summary = overviewSummary?.summary || {};

  if (loading) return <p className="text-slate-400">{t('soc.pages.status_loading')}</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">{t('soc.pages.service_list')}</h2>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {[
          [t('soc.pages.total_services'), summary.total || 0],
          [t('soc.health.status_healthy'), summary.healthy || 0],
          [t('soc.health.status_degraded'), summary.degraded || 0],
          [t('soc.health.status_critical'), summary.unhealthy || 0],
          [t('soc.health.status_unknown'), summary.unknown || 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-700 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((service) => (
          <ServiceHealthCard
            key={service.service_key}
            service={service}
            health={healthByServiceKey[service.service_key] || { status: 'unknown' }}
            t={t}
          />
        ))}
      </div>

      <div className="mt-8 p-6 bg-slate-900 rounded-lg border border-slate-700">
        <h3 className="text-xl font-bold text-white mb-4">{t('soc.pages.configuration')}</h3>
        <p className="text-slate-400">{t('soc.pages.status_loading')} detailed config view...</p>
      </div>
    </div>
  );
};

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
OverviewPanel.propTypes = {
  t: PropTypes.func.isRequired,
  services: PropTypes.array.isRequired,
};

export default OverviewPanel;
