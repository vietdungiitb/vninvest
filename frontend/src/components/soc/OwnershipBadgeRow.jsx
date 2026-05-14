/**
 * Ownership Badge Row — displays domain ownership + write permission
 * Shows write mode (native-write/bridge-write/read-only) + can_apply status
 */
import PropTypes from 'prop-types';

const MODE_COLORS = {
  'native-write': { bg: 'bg-green-900', border: 'border-green-700', badge: 'bg-green-700' },
  'bridge-write': { bg: 'bg-yellow-900', border: 'border-yellow-700', badge: 'bg-yellow-700' },
  'read-only': { bg: 'bg-gray-900', border: 'border-gray-700', badge: 'bg-gray-700' },
  'canonical': { bg: 'bg-blue-900', border: 'border-blue-700', badge: 'bg-blue-700' },
  'deprecated': { bg: 'bg-red-900', border: 'border-red-700', badge: 'bg-red-700' },
};

export const OwnershipBadgeRow = ({ domain, ownership, t }) => {
  const colors = MODE_COLORS[ownership.mode] || MODE_COLORS['read-only'];
  const canApply = ownership.can_apply ? 'text-green-300' : 'text-red-300';

  return (
    <div className={`${colors.bg} border ${colors.border} rounded-lg p-3`}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-white">{domain}</h4>
          <p className="text-xs text-gray-300">
            {t('soc.ownership.owned_by')}: {ownership.owner_team}
          </p>
        </div>
        <div className="flex gap-2">
          <span className={`${colors.badge} px-3 py-1 rounded text-white text-xs font-bold`}>
            {ownership.mode}
          </span>
          <span className={`${canApply} px-3 py-1 rounded text-xs font-bold`}>
            {ownership.can_apply ? '✓ ' + t('soc.ownership.writable') : '✗ ' + t('soc.ownership.readonly')}
          </span>
        </div>
      </div>
      {ownership.write_surface && (
        <p className="text-xs text-gray-400 mt-2">
          {t('soc.ownership.surface')}: {ownership.write_surface}
        </p>
      )}
      {ownership.locked_fields && ownership.locked_fields.length > 0 && (
        <p className="text-xs text-gray-400 mt-1">
          {t('soc.ownership.locked_fields')}: {ownership.locked_fields.join(', ')}
        </p>
      )}
    </div>
  );
};

OwnershipBadgeRow.propTypes = {
  domain: PropTypes.string.isRequired,
  ownership: PropTypes.shape({
    mode: PropTypes.string.isRequired,
    owner_team: PropTypes.string.isRequired,
    can_apply: PropTypes.bool.isRequired,
    write_surface: PropTypes.string,
    locked_fields: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  t: PropTypes.func.isRequired, // useI18n().t
};
