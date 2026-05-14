/**
 * OverviewPanel.jsx — Service overview with health grid and config version
 */
import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { socApi } from '../api/socApi';
import { ServiceHealthCard } from '../components/soc/ServiceHealthCard';

const OverviewPanel = ({ t, services }) => {
  const [serviceDetails, setServiceDetails] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const details = await Promise.all(
          services.map(svc => socApi.getServiceDetail(svc.service_key))
        );
        setServiceDetails(details);
      } catch (err) {
        console.error('Failed to fetch service details:', err);
      } finally {
        setLoading(false);
      }
    };

    if (services.length > 0) {
      fetchDetails();
    } else {
      setLoading(false);
    }
  }, [services]);

  if (loading) return <p className="text-slate-400">{t('soc.pages.status_loading')}</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">{t('soc.pages.service_list')}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {serviceDetails.map(svc => (
          <ServiceHealthCard
            key={svc.service_key}
            service_key={svc.service_key}
            status={svc.health?.status || 'unknown'}
            last_check={svc.health?.last_check}
            reason={svc.health?.reason}
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

OverviewPanel.propTypes = {
  t: PropTypes.func.isRequired,
  services: PropTypes.array.isRequired,
};

export default OverviewPanel;
