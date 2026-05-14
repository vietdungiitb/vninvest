/**
 * Write Guard Banner — amber warning banner cho domains bị khóa ghi
 * Hiển thị lý do tại sao không thể apply config
 */
import PropTypes from 'prop-types';

export const WriteGuardBanner = ({ domain, blockReason, writeSurface, t }) => {
  if (!blockReason) return null;

  return (
    <div className="bg-amber-900 border border-amber-700 rounded-lg p-4 mb-4">
      <div className="flex gap-3">
        <div className="text-amber-400 text-xl flex-shrink-0">⚠️</div>
        <div className="text-amber-100">
          <h4 className="font-bold mb-1">
            {t('soc.guard.write_blocked_title')}
          </h4>
          <p className="text-sm mb-2">{blockReason}</p>
          {writeSurface && (
            <p className="text-xs text-amber-300">
              {t('soc.guard.write_surface')}: <span className="font-mono">{writeSurface}</span>
            </p>
          )}
          <p className="text-xs text-amber-300 mt-1">
            {t('soc.guard.contact_owner')}
          </p>
        </div>
      </div>
    </div>
  );
};

WriteGuardBanner.propTypes = {
  domain: PropTypes.string.isRequired,
  blockReason: PropTypes.string,
  writeSurface: PropTypes.string,
  t: PropTypes.func.isRequired,
};
