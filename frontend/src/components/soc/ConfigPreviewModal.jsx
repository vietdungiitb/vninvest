/**
 * Config Preview Modal — before/after diff view cho config changes
 * Cho phép user xem sự thay đổi trước khi apply
 */
import PropTypes from 'prop-types';

export const ConfigPreviewModal = ({ isOpen, before, after, onClose, onApply, t }) => {
  if (!isOpen) return null;

  const getChangedKeys = () => {
    const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    const changed = [];
    allKeys.forEach(key => {
      if (JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])) {
        changed.push(key);
      }
    });
    return changed;
  };

  const changedKeys = getChangedKeys();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-950 border border-slate-700 rounded-lg max-w-2xl w-full max-h-96 overflow-auto p-6">
        <h3 className="text-lg font-bold text-white mb-4">{t('soc.preview.title')}</h3>

        {changedKeys.length === 0 ? (
          <p className="text-slate-400">{t('soc.preview.no_changes')}</p>
        ) : (
          <div className="space-y-4">
            {changedKeys.map(key => (
              <div key={key} className="border border-slate-700 rounded p-3 bg-slate-900">
                <p className="font-mono text-sm text-slate-300 mb-2">{key}</p>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <p className="text-xs text-red-300 mb-1">{t('soc.preview.before')}</p>
                    <p className="font-mono text-xs text-slate-400 bg-red-950 p-2 rounded">
                      {JSON.stringify(before?.[key], null, 2)}
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-green-300 mb-1">{t('soc.preview.after')}</p>
                    <p className="font-mono text-xs text-slate-400 bg-green-950 p-2 rounded">
                      {JSON.stringify(after?.[key], null, 2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm"
          >
            {t('soc.preview.cancel')}
          </button>
          <button
            onClick={onApply}
            disabled={changedKeys.length === 0}
            className="px-4 py-2 bg-green-700 hover:bg-green-600 disabled:bg-gray-600 rounded text-white text-sm font-bold"
          >
            {t('soc.preview.apply')}
          </button>
        </div>
      </div>
    </div>
  );
};

ConfigPreviewModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  before: PropTypes.object,
  after: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onApply: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
};
