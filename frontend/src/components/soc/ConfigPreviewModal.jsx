/**
 * Config Preview Modal — before/after diff view cho config changes
 * Cho phép user xem sự thay đổi trước khi apply
 */
import PropTypes from 'prop-types';

export const ConfigPreviewModal = ({
  isOpen,
  before,
  after,
  onClose,
  onConfirm,
  changeSummary = [],
  impactWarnings = [],
  validationErrors = null,
  domain,
  isSubmitting = false,
  t,
}) => {
  if (!isOpen) return null;

  const getChangedKeys = () => {
    const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    const changed = [];
    allKeys.forEach((key) => {
      if (JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])) {
        changed.push(key);
      }
    });
    return changed;
  };

  const changedKeys = getChangedKeys();
  const validationEntries = Object.entries(validationErrors || {});
  const hasValidationErrors = validationEntries.length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-950 border border-slate-700 rounded-lg max-w-2xl w-full max-h-96 overflow-auto p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white">{t('soc.preview.title')}</h3>
            <p className="mt-1 text-xs text-slate-400">
              {t('soc.preview.domain')}: <span className="font-mono text-slate-200">{domain}</span>
            </p>
          </div>
        </div>

        {changeSummary.length > 0 && (
          <div className="mb-4 rounded border border-slate-700 bg-slate-900 p-3">
            <p className="mb-2 text-sm font-semibold text-white">{t('soc.preview.change_summary')}</p>
            <ul className="space-y-1 text-xs text-slate-300">
              {changeSummary.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
        )}

        {impactWarnings.length > 0 && (
          <div className="mb-4 rounded border border-amber-700 bg-amber-950/40 p-3">
            <p className="mb-2 text-sm font-semibold text-amber-200">{t('soc.preview.impact_warnings')}</p>
            <ul className="space-y-1 text-xs text-amber-100">
              {impactWarnings.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
        )}

        {hasValidationErrors && (
          <div className="mb-4 rounded border border-rose-700 bg-rose-950/30 p-3">
            <p className="mb-2 text-sm font-semibold text-rose-200">{t('soc.preview.validation_errors')}</p>
            <div className="space-y-2 text-xs text-rose-100">
              {validationEntries.map(([field, errors]) => (
                <div key={field}>
                  <p className="font-semibold text-rose-200">{field}</p>
                  <ul className="mt-1 space-y-1">
                    {(Array.isArray(errors) ? errors : [errors]).map((errorItem) => (
                      <li key={`${field}-${errorItem}`}>- {errorItem}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

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
            onClick={onConfirm}
            disabled={changedKeys.length === 0 || hasValidationErrors || isSubmitting}
            className="px-4 py-2 bg-green-700 hover:bg-green-600 disabled:bg-gray-600 rounded text-white text-sm font-bold"
          >
            {isSubmitting ? t('soc.preview.submitting') : t('soc.preview.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
ConfigPreviewModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  before: PropTypes.object,
  after: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  changeSummary: PropTypes.arrayOf(PropTypes.string),
  impactWarnings: PropTypes.arrayOf(PropTypes.string),
  validationErrors: PropTypes.object,
  domain: PropTypes.string.isRequired,
  isSubmitting: PropTypes.bool,
  t: PropTypes.func.isRequired,
};
