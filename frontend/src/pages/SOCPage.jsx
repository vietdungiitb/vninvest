import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useI18n } from '../context/LangContext';
import { socApi } from '../api/socApi';
import { SOCDomainTabs } from '../components/soc/SOCDomainTabs';
import DataOpsPanel from '../components/soc/DataOpsPanel';
import OverviewPanel from '../components/soc/OverviewPanel';
import PrefetchPanel from '../components/soc/PrefetchPanel';
import SignalsPanel from '../components/soc/SignalsPanel';
import ScreenerPanel from '../components/soc/ScreenerPanel';
import MatrixPanel from '../components/soc/MatrixPanel';
import VnbrokerPanel from '../components/soc/VnbrokerPanel';
import RuntimeKPIPanel from '../components/soc/RuntimeKPIPanel';

const VALID_DOMAINS = ['overview', 'signals', 'dataops', 'prefetch', 'screener', 'vnbroker', 'runtime-kpi', 'matrix'];

const SOCPage = ({ t }) => {
  const { t: translate } = useI18n();
  const pageT = typeof t === 'function' ? t : translate;
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') || searchParams.get('domain') || 'overview';
  const activeDomain = VALID_DOMAINS.includes(requestedTab) ? requestedTab : 'overview';
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
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', domain);
    nextParams.delete('domain');
    setSearchParams(nextParams);
  };

  const panels = {
    overview: <OverviewPanel t={pageT} services={serviceList} />,
    signals: <SignalsPanel t={pageT} />,
    dataops: <DataOpsPanel t={pageT} />,
    prefetch: <PrefetchPanel t={pageT} />,
    screener: <ScreenerPanel t={pageT} />,
    vnbroker: <VnbrokerPanel t={pageT} />,
    'runtime-kpi': <RuntimeKPIPanel t={pageT} />,
    matrix: <MatrixPanel t={pageT} />,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-900 p-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold">{pageT('soc.pages.soc_page_title')}</h1>
          <p className="text-slate-400 mt-1">
            {pageT('soc.pages.breadcrumb_operations')}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <SOCDomainTabs activeDomain={activeDomain} onDomainChange={handleDomainChange} t={pageT} />

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6">
        {error && (
          <div className="bg-red-900 border border-red-700 p-4 rounded-lg mb-4">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <p className="text-slate-400">{pageT('soc.pages.status_loading')}</p>
          </div>
        )}

        {!loading && panels[activeDomain]}
      </div>
    </div>
  );
};

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
SOCPage.propTypes = {
  t: PropTypes.func,
};

export default SOCPage;
