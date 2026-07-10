import { useCallback } from 'react';

const LOG_KEY = 'vninvest:trust-telemetry-log';
const COUNTER_KEY = 'vninvest:trust-telemetry-counters';

export function useTrustTelemetry() {
  const appendToLocalStorage = useCallback((detail) => {
    try {
      const currentLog = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
      const nextLog = [...currentLog.slice(-199), detail];
      localStorage.setItem(LOG_KEY, JSON.stringify(nextLog));

      const counters = JSON.parse(localStorage.getItem(COUNTER_KEY) || '{}');
      const currentCount = Number(counters[detail.event] || 0);
      counters[detail.event] = currentCount + 1;
      counters.__last_ts = detail.ts;
      localStorage.setItem(COUNTER_KEY, JSON.stringify(counters));
    } catch (_err) {
      // non-blocking
    }
  }, []);

  const emit = useCallback((event, payload = {}) => {
    const detail = { event, ts: new Date().toISOString(), ...payload };
    try {
      window.dispatchEvent(new CustomEvent('vninvest:trust_telemetry', { detail }));
      appendToLocalStorage(detail);
    } catch (_err) {
      // non-blocking
    }
  }, [appendToLocalStorage]);

  const trackExplainabilityOpened = useCallback(
    (symbol) => emit('recommendation_explainability_opened', { symbol }),
    [emit],
  );

  const trackExplainabilityInsufficient = useCallback(
    (symbol, reason) => emit('recommendation_explainability_insufficient', { symbol, reason }),
    [emit],
  );

  const trackRiskModeChanged = useCallback(
    (symbol, riskMode) => emit('recommendation_risk_mode_changed', { symbol, riskMode }),
    [emit],
  );

  const trackActionChecklistCompleted = useCallback(
    (symbol) => emit('recommendation_action_checklist_completed', { symbol }),
    [emit],
  );

  const trackActionAttemptBlocked = useCallback(
    (symbol, reason) => emit('recommendation_action_attempt_blocked', { symbol, reason }),
    [emit],
  );

  const trackHistoryOpened = useCallback(
    (symbol) => emit('recommendation_history_opened', { symbol }),
    [emit],
  );

  return {
    trackExplainabilityOpened,
    trackExplainabilityInsufficient,
    trackRiskModeChanged,
    trackActionChecklistCompleted,
    trackActionAttemptBlocked,
    trackHistoryOpened,
  };
}
export default useTrustTelemetry;
