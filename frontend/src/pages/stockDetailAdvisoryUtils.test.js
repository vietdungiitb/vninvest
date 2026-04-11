import { resolveAdvisoryConflictState } from './stockDetailAdvisoryUtils';

describe('resolveAdvisoryConflictState', () => {
  it('maps missing system settings conflict to specific translated message', () => {
    const t = (key) => {
      const map = {
        'stockDetail.aiAdvisoryConflictMissingSystemSettings': 'Missing system settings message',
        'stockDetail.aiAdvisoryConflictAiNotConfigured': 'Generic ai not configured',
        'stockDetail.loadAiAdvisoryFailed': 'Load failed',
      };
      return map[key] || key;
    };

    const state = resolveAdvisoryConflictState(
      {
        reason: 'ai_not_configured',
        config_issue: 'missing_system_ai_settings',
      },
      t
    );

    expect(state.message).toBe('Missing system settings message');
    expect(state.reason).toBe('ai_not_configured');
    expect(state.configIssue).toBe('missing_system_ai_settings');
    expect(state.components).toEqual([]);
  });

  it('prioritizes backend message when present', () => {
    const state = resolveAdvisoryConflictState(
      {
        reason: 'ai_not_configured',
        message: 'Backend says configure AI first',
        components: [{ id: 10 }],
      },
      () => 'fallback'
    );

    expect(state.message).toBe('Backend says configure AI first');
    expect(state.components).toEqual([{ id: 10 }]);
  });
});
