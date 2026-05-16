/**
 * RuntimeKPIPanel.jsx — Runtime KPI overview (placeholder for future telemetry)
 */
import PropTypes from 'prop-types';

const RuntimeKPIPanel = ({ t }) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">{t('soc.runtime_kpi.title')}</h2>
      </div>

      <div className="p-8 bg-slate-900 rounded-lg border border-slate-700 text-center">
        <p className="text-slate-400 text-sm">{t('soc.runtime_kpi.coming_soon')}</p>
      </div>
    </div>
  );
};

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
RuntimeKPIPanel.propTypes = {
  t: PropTypes.func.isRequired,
};

export default RuntimeKPIPanel;
