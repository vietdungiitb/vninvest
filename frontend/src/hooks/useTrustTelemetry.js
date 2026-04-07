import { useCallback } from 'react';

/**
 * useTrustTelemetry – emit trust-related UX events for Sprint 24 KPI tracking.
 *
 * Events (6 total):
 *   recommendation_explainability_opened   – user expanded "why" panel
 *   recommendation_explainability_insufficient – data absent, couldn't explain
 *   recommendation_risk_mode_changed        – user switched risk mode
 *   recommendation_action_checklist_completed – all action items checked
 *   recommendation_action_attempt_blocked   – action blocked (staleness / confidence)
 *   recommendation_history_opened           – user opened T+1/T+3/T+5 history
 *
 * Payload shape: { event, symbol?, riskMode?, confidence?, reason? }
 *
 * Currently writes to console in dev and fires a CustomEvent on window so
 * analytics adapters can subscribe without tight coupling.
 */
export default function useTrustTelemetry() {
  const LOG_KEY = 'vninvest:trust-telemetry-log';
  const COUNTER_KEY = 'vninvest:trust-telemetry-counters';

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
      // non-blocking — local persistence should not affect user flow
    }
  }, []);

  const emit = useCallback((event, payload = {}) => {
    const detail = { event, ts: new Date().toISOString(), ...payload };

    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('[TrustTelemetry]', detail);
    }

    try {
      window.dispatchEvent(new CustomEvent('vninvest:trust_telemetry', { detail }));
      appendToLocalStorage(detail);
    } catch (_err) {
      // non-blocking — telemetry failures must never crash UI
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
