/**
 * SOCPage.jsx — Service Operations Center main page
 * Route: /operations-center
 */
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import { socApi } from '../api/socApi';
import { SOCDomainTabs } from '../components/soc/SOCDomainTabs';
import OverviewPanel from '../components/soc/OverviewPanel';
import VnbrokerPanel from '../components/soc/VnbrokerPanel';
import PrefetchPanel from '../components/soc/PrefetchPanel';
import SignalsPanel from '../components/soc/SignalsPanel';
import ScreenerPanel from '../components/soc/ScreenerPanel';
import MatrixPanel from '../components/soc/MatrixPanel';

const SOCPage = ({ t }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeDomain = searchParams.get('domain') || 'overview';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [serviceList, setServiceList] = useState([]);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const data = await socApi.getServiceList();
        setServiceList(data.results || []);
        setError(null);
      } catch (err) {
        setError(err.message);
        console.error('Failed to fetch services:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  const handleDomainChange = (domain) => {
    setSearchParams({ domain });
  };

  const panels = {
    overview: <OverviewPanel t={t} services={serviceList} />,
    vnbroker: <VnbrokerPanel t={t} />,
    prefetch: <PrefetchPanel t={t} />,
    signals: <SignalsPanel t={t} />,
    screener: <ScreenerPanel t={t} />,
    matrix: <MatrixPanel t={t} />,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-900 p-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold">{t('soc.pages.soc_page_title')}</h1>
          <p className="text-slate-400 mt-1">
            {t('soc.pages.breadcrumb_operations')}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <SOCDomainTabs activeDomain={activeDomain} onDomainChange={handleDomainChange} t={t} />

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6">
        {error && (
          <div className="bg-red-900 border border-red-700 p-4 rounded-lg mb-4">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <p className="text-slate-400">{t('soc.pages.status_loading')}</p>
          </div>
        )}

        {!loading && panels[activeDomain]}
      </div>
    </div>
  );
};

SOCPage.propTypes = {
  t: PropTypes.func.isRequired,
};

export default SOCPage;
