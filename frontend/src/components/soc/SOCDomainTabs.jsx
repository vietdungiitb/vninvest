/**
 * SOCDomainTabs — Tab navigation cho 8 domains
 * Overview | Signals | DataOps | Prefetch | Screener | VNBroker | Runtime KPI | Matrix
 */
import PropTypes from 'prop-types';

export const SOCDomainTabs = ({ activeDomain, onDomainChange, t }) => {
  const domains = [
    { key: 'overview', label: t('soc.tab.overview') },
    { key: 'signals', label: t('soc.tab.signals') },
    { key: 'dataops', label: t('soc.tab.dataops') },
    { key: 'prefetch', label: t('soc.tab.prefetch') },
    { key: 'screener', label: t('soc.tab.screener') },
    { key: 'vnbroker', label: t('soc.tabs.vnbroker') },
    { key: 'runtime-kpi', label: t('soc.tabs.runtime_kpi') },
    { key: 'matrix', label: t('soc.tab.matrix') },
  ];

  return (
    <div className="border-b border-slate-700">
      <div className="flex flex-wrap gap-1 p-2 bg-slate-950">
        {domains.map(domain => (
          <button
            key={domain.key}
            onClick={() => onDomainChange(domain.key)}
            className={`px-4 py-2 rounded-t text-sm font-medium transition-colors ${
              activeDomain === domain.key
                ? 'bg-slate-700 text-white border-b-2 border-blue-500'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {domain.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
SOCDomainTabs.propTypes = {
  activeDomain: PropTypes.string.isRequired,
  onDomainChange: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
};
