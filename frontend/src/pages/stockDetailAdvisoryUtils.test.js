import {
  getAdvisoryConflictRetryDelayMs,
  resolveAdvisoryConflictState,
  shouldAutoRetryAdvisoryConflict,
} from './stockDetailAdvisoryUtils';

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

describe('advisory conflict retry helpers', () => {
  it('does not auto retry when AI is not configured', () => {
    expect(shouldAutoRetryAdvisoryConflict({ reason: 'ai_not_configured' })).toBe(false);
  });

  it('auto retries for transient conflict reasons', () => {
    expect(shouldAutoRetryAdvisoryConflict({ reason: 'session_conflict' })).toBe(true);
    expect(shouldAutoRetryAdvisoryConflict({ reason: '' })).toBe(true);
  });

  it('computes exponential delay with cap', () => {
    expect(getAdvisoryConflictRetryDelayMs(1)).toBe(2000);
    expect(getAdvisoryConflictRetryDelayMs(2)).toBe(4000);
    expect(getAdvisoryConflictRetryDelayMs(3)).toBe(8000);
    expect(getAdvisoryConflictRetryDelayMs(5)).toBe(15000);
  });
});
