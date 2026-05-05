import { act, renderHook } from '@testing-library/react';
import usePersistentAlertState from './usePersistentAlertState';

describe('usePersistentAlertState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('migrates legacy sound state to alert_sound and toggles the new key', () => {
    window.localStorage.setItem('dashboard.alerts.critical_sound_enabled', 'false');

    const { result } = renderHook(() => usePersistentAlertState());

    expect(result.current.criticalSoundEnabled).toBe(false);
    expect(window.localStorage.getItem('dashboard.alerts.alert_sound')).toBe('false');

    act(() => {
      result.current.toggleCriticalSound();
    });

    expect(result.current.criticalSoundEnabled).toBe(true);
    expect(window.localStorage.getItem('dashboard.alerts.alert_sound')).toBe('true');
    expect(window.localStorage.getItem('dashboard.alerts.critical_sound_enabled')).toBe('true');
  });
});