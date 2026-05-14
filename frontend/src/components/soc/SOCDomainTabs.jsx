/**
 * SOCDomainTabs — Tab navigation cho 6 domains
 * Overview | VNBroker | Prefetch | Signals | Screener | Matrix
 */
import PropTypes from 'prop-types';

export const SOCDomainTabs = ({ activeDomain, onDomainChange, t }) => {
  const domains = [
    { key: 'overview', label: t('soc.tabs.overview') },
    { key: 'vnbroker', label: t('soc.tabs.vnbroker') },
    { key: 'prefetch', label: t('soc.tabs.prefetch') },
    { key: 'signals', label: t('soc.tabs.signals') },
    { key: 'screener', label: t('soc.tabs.screener') },
    { key: 'matrix', label: t('soc.tabs.matrix') },
  ];

  return (
    <div className="border-b border-slate-700">
      <div className="flex gap-1 p-2 bg-slate-950">
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

SOCDomainTabs.propTypes = {
  activeDomain: PropTypes.string.isRequired,
  onDomainChange: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
};
