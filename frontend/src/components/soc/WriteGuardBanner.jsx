/**
 * Write Guard Banner — amber warning banner cho domains bị khóa ghi
 * Hiển thị lý do tại sao không thể apply config
 */
import PropTypes from 'prop-types';
import { Lock } from 'lucide-react';

export const WriteGuardBanner = ({ reason, writer, writeSurface, t }) => {
  if (!reason) return null;

  return (
    <div className="bg-amber-900 border border-amber-700 rounded-lg p-4 mb-4">
      <div className="flex gap-3">
        <div className="flex-shrink-0 rounded-full bg-amber-950/80 p-2 text-amber-300">
          <Lock className="h-5 w-5" />
        </div>
        <div className="text-amber-100">
          <h4 className="font-bold mb-1">
            {t('soc.guard.write_blocked_title')}
          </h4>
          <p className="text-sm mb-2">{reason}</p>
          {writer && (
            <p className="text-xs text-amber-300">
              {t('soc.guard.writer')}: <span className="font-mono">{writer}</span>
            </p>
          )}
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

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
WriteGuardBanner.propTypes = {
  reason: PropTypes.string,
  writer: PropTypes.string,
  writeSurface: PropTypes.string,
  t: PropTypes.func.isRequired,
};
