function translate(t, key, fallback) {
  if (typeof t !== 'function') {
    return fallback;
  }
  const value = t(key);
  if (typeof value === 'string' && value.length > 0 && value !== key) {
    return value;
  }
  return fallback;
}

export function resolveAdvisoryConflictState(responseData, t) {
  const payload = responseData && typeof responseData === 'object' ? responseData : {};
  const reason = String(payload.reason || '').toLowerCase();
  const configIssue = String(payload.config_issue || '').toLowerCase();

  let fallbackMessage = translate(
    t,
    'stockDetail.loadAiAdvisoryFailed',
    'Unable to load AI advisory for this symbol.'
  );

  if (reason === 'ai_not_configured' && configIssue === 'missing_system_ai_settings') {
    fallbackMessage = translate(
      t,
      'stockDetail.aiAdvisoryConflictMissingSystemSettings',
      'AI advisory service is not ready because system AI settings are missing.'
    );
  } else if (reason === 'ai_not_configured') {
    fallbackMessage = translate(
      t,
      'stockDetail.aiAdvisoryConflictAiNotConfigured',
      'AI advisory is not configured for this account yet.'
    );
  }

  return {
    message: payload.message || fallbackMessage,
    reason,
    configIssue,
    advisory: payload.advisory || null,
    aggregate: payload.aggregate || null,
    userAiProvider: payload.user_ai_provider || null,
    components: Array.isArray(payload.components) ? payload.components : [],
    deletedComponents: Array.isArray(payload.deleted_components) ? payload.deleted_components : [],
    executiveSummary: payload.executive_summary || null,
    executiveSummaries: Array.isArray(payload.executive_summaries) ? payload.executive_summaries : [],
  };
}
