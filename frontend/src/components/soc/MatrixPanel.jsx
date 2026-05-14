/**
 * MatrixPanel.jsx — ScrapeMatrix monitoring (optional T06)
 */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { MatrixScrapeMonitor } from './MatrixScrapeMonitor';

const MatrixPanel = ({ t }) => {
  const [cycleId] = useState('current'); // Placeholder; in real implementation, fetch active cycle ID

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">{t('soc.tabs.matrix')}</h2>

      <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
        <p className="text-slate-400 mb-4">
          {t('soc.matrix.monitor_title')} — Real-time scrape status monitoring
        </p>
        <MatrixScrapeMonitor cycleId={cycleId} t={t} />
      </div>

      <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">{t('soc.matrix.monitor_title')}</h3>
        <p className="text-slate-400">
          Note: Matrix monitoring requires T06 ScrapeMatrix implementation. Currently in stub mode.
        </p>
      </div>
    </div>
  );
};

MatrixPanel.propTypes = {
  t: PropTypes.func.isRequired,
};

export default MatrixPanel;
