/**
 * Service Health Status Card — displays health status with color coding
 * Tailwind dark theme (slate-950 base)
 */
import PropTypes from 'prop-types';

// Status -> Tailwind color map
const STATUS_COLORS = {
  healthy: { bg: 'bg-green-900', border: 'border-green-700', text: 'text-green-100' },
  degraded: { bg: 'bg-yellow-900', border: 'border-yellow-700', text: 'text-yellow-100' },
  unhealthy: { bg: 'bg-red-900', border: 'border-red-700', text: 'text-red-100' },
  unknown: { bg: 'bg-gray-900', border: 'border-gray-700', text: 'text-gray-100' },
  maintenance: { bg: 'bg-purple-900', border: 'border-purple-700', text: 'text-purple-100' },
};

export const ServiceHealthCard = ({ service, health }) => {
  const colors = STATUS_COLORS[health.status] || STATUS_COLORS.unknown;

  return (
    <div className={`${colors.bg} border ${colors.border} rounded-lg p-4 ${colors.text}`}>
      <h3 className="font-bold">{service.name}</h3>
      <p className="text-sm">Status: {health.status}</p>
      {health.avg_response_ms && (
        <p className="text-xs text-gray-300">Latency: {health.avg_response_ms.toFixed(0)}ms</p>
      )}
    </div>
  );
};

ServiceHealthCard.propTypes = {
  service: PropTypes.shape({
    name: PropTypes.string.isRequired,
    service_key: PropTypes.string.isRequired,
  }).isRequired,
  health: PropTypes.shape({
    status: PropTypes.string.isRequired,
    avg_response_ms: PropTypes.number,
  }).isRequired,
};
