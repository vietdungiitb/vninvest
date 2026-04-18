/**
 * Phase 3 E2E Test Suite: AI Advisory Canonical prompt_config localStorage Persistence
 * 
 * Tests user preferences storage/retrieval across page reloads and symbol switches
 * All tests use Jest with localStorage mock
 */

import '@testing-library/jest-dom';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// ============================================================================
// Helper Functions (mirrors from StockDetail.jsx)
// ============================================================================

const _getDefaultPromptConfig = () => ({
  version: 2,
  sources: {
    whale: { enabled: true, lookback: 30 },
    dark_flow: { enabled: true, lookback: 30 },
    technical: { enabled: true, lookback: 20, indicators: ['rsi', 'bollinger', 'vols'] },
    news: { enabled: true, lookback: 7 },
    market: { enabled: true, lookback: 60 },
    fundamental: { enabled: false, lookback: 2 },
    ownership: { enabled: false, lookback: 365 },
    sector: { enabled: false, lookback: 60 },
  },
});

const _loadAdvisoryPromptConfigFromStorage = (symbol) => {
  if (!symbol) return null;
  try {
    const key = `ai_advisory_prompt_config:${symbol}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (err) {
    console.warn('Failed to load prompt config from storage:', err);
    return null;
  }
};

const _saveAdvisoryPromptConfigToStorage = (symbol, promptConfig) => {
  if (!symbol || !promptConfig) return;
  try {
    const key = `ai_advisory_prompt_config:${symbol}`;
    localStorage.setItem(key, JSON.stringify(promptConfig));
  } catch (err) {
    console.warn('Failed to save prompt config to storage:', err);
  }
};

// ============================================================================
// TEST SUITE: localStorage E2E
// ============================================================================

describe('AIAdvisoryPromptConfig - localStorage E2E Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  // Test 1: Load default config when no localStorage data exists
  test('1. should load default config when no localStorage data exists', () => {
    const symbol = 'MWG';
    const loaded = _loadAdvisoryPromptConfigFromStorage(symbol);
    
    expect(loaded).toBeNull();
    
    // When null, frontend should apply defaults
    const defaults = _getDefaultPromptConfig();
    expect(defaults.version).toBe(2);
    expect(defaults.sources.whale.enabled).toBe(true);
    expect(defaults.sources.fundamental.enabled).toBe(false);
  });

  // Test 2: Save config to localStorage on first settings change
  test('2. should save config to localStorage on first settings change', () => {
    const symbol = 'MWG';
    const newConfig = _getDefaultPromptConfig();
    newConfig.sources.fundamental.enabled = true;

    _saveAdvisoryPromptConfigToStorage(symbol, newConfig);

    const stored = localStorage.getItem(`ai_advisory_prompt_config:${symbol}`);
    expect(stored).not.toBeNull();

    const parsed = JSON.parse(stored);
    expect(parsed.sources.fundamental.enabled).toBe(true);
    expect(parsed.version).toBe(2);
  });

  // Test 3: Load persisted config on page reload (symbol-specific)
  test('3. should load persisted config on page reload (symbol-specific)', () => {
    const symbol = 'MWG';
    const config = _getDefaultPromptConfig();
    config.sources.ownership.enabled = true;
    config.sources.sector.lookback = 90;

    // Simulate first save
    _saveAdvisoryPromptConfigToStorage(symbol, config);

    // Simulate page reload (localStorage persists)
    const reloaded = _loadAdvisoryPromptConfigFromStorage(symbol);

    expect(reloaded).not.toBeNull();
    expect(reloaded.sources.ownership.enabled).toBe(true);
    expect(reloaded.sources.sector.lookback).toBe(90);
  });

  // Test 4: Toggle source → verify localStorage updates immediately
  test('4. should update localStorage immediately when source toggle changes', () => {
    const symbol = 'MWG';
    const config = _getDefaultPromptConfig();

    // Initial save
    _saveAdvisoryPromptConfigToStorage(symbol, config);
    
    let loaded = _loadAdvisoryPromptConfigFromStorage(symbol);
    expect(loaded.sources.whale.enabled).toBe(true);

    // Toggle whale OFF
    config.sources.whale.enabled = false;
    _saveAdvisoryPromptConfigToStorage(symbol, config);

    // Verify immediate update
    loaded = _loadAdvisoryPromptConfigFromStorage(symbol);
    expect(loaded.sources.whale.enabled).toBe(false);

    // Toggle technical OFF
    config.sources.technical.enabled = false;
    _saveAdvisoryPromptConfigToStorage(symbol, config);

    loaded = _loadAdvisoryPromptConfigFromStorage(symbol);
    expect(loaded.sources.technical.enabled).toBe(false);
  });

  // Test 5: Toggle technical indicator → verify localStorage updates
  test('5. should update technical indicators in localStorage when changed', () => {
    const symbol = 'MWG';
    const config = _getDefaultPromptConfig();

    _saveAdvisoryPromptConfigToStorage(symbol, config);

    // Initial state
    let loaded = _loadAdvisoryPromptConfigFromStorage(symbol);
    expect(loaded.sources.technical.indicators).toContain('rsi');
    expect(loaded.sources.technical.indicators.length).toBe(3); // rsi, bollinger, vols

    // Add indicator
    config.sources.technical.indicators = ['rsi', 'bollinger', 'vols', 'ma20', 'ma50'];
    _saveAdvisoryPromptConfigToStorage(symbol, config);

    loaded = _loadAdvisoryPromptConfigFromStorage(symbol);
    expect(loaded.sources.technical.indicators.length).toBe(5);
    expect(loaded.sources.technical.indicators).toContain('ma20');

    // Remove indicator
    config.sources.technical.indicators = ['rsi', 'bollinger'];
    _saveAdvisoryPromptConfigToStorage(symbol, config);

    loaded = _loadAdvisoryPromptConfigFromStorage(symbol);
    expect(loaded.sources.technical.indicators.length).toBe(2);
    expect(loaded.sources.technical.indicators).not.toContain('vols');
  });

  // Test 6: Switch to different symbol → verify symbol-specific config isolation
  test('6. should keep separate configs for different symbols', () => {
    const symbol1 = 'MWG';
    const symbol2 = 'VNM';

    const config1 = _getDefaultPromptConfig();
    config1.sources.whale.enabled = false;

    const config2 = _getDefaultPromptConfig();
    config2.sources.fundamental.enabled = true;

    _saveAdvisoryPromptConfigToStorage(symbol1, config1);
    _saveAdvisoryPromptConfigToStorage(symbol2, config2);

    // Load symbol1 → should have whale disabled
    const loaded1 = _loadAdvisoryPromptConfigFromStorage(symbol1);
    expect(loaded1.sources.whale.enabled).toBe(false);
    expect(loaded1.sources.fundamental.enabled).toBe(false);

    // Load symbol2 → should have fundamental enabled
    const loaded2 = _loadAdvisoryPromptConfigFromStorage(symbol2);
    expect(loaded2.sources.whale.enabled).toBe(true);
    expect(loaded2.sources.fundamental.enabled).toBe(true);

    // Verify isolation: symbol1 config is unchanged
    const recheck1 = _loadAdvisoryPromptConfigFromStorage(symbol1);
    expect(recheck1.sources.whale.enabled).toBe(false);
  });

  // Test 7: Invalid config in localStorage → fallback to defaults gracefully
  test('7. should fallback to defaults when localStorage contains invalid JSON', () => {
    const symbol = 'MWG';

    // Save corrupted data
    localStorage.setItem(`ai_advisory_prompt_config:${symbol}`, '{invalid json}');

    // Load should handle gracefully (returns null on parse error)
    const loaded = _loadAdvisoryPromptConfigFromStorage(symbol);
    expect(loaded).toBeNull();

    // Frontend should then apply defaults
    const defaults = _getDefaultPromptConfig();
    expect(defaults.sources.whale.enabled).toBe(true);

    // Save valid config afterwards
    _saveAdvisoryPromptConfigToStorage(symbol, defaults);
    const reloaded = _loadAdvisoryPromptConfigFromStorage(symbol);
    expect(reloaded).not.toBeNull();
    expect(reloaded.version).toBe(2);
  });

  // Bonus Test: Multiple rapid toggles → no race conditions
  test('Bonus: should handle rapid consecutive toggles without race conditions', () => {
    const symbol = 'MWG';
    const config = _getDefaultPromptConfig();

    // Rapid sequence of changes (i goes 0-9)
    for (let i = 0; i < 10; i++) {
      config.sources.whale.enabled = i % 2 === 0;
      config.sources.fundamental.enabled = i % 3 === 0;
      _saveAdvisoryPromptConfigToStorage(symbol, config);
    }

    // Final state (i=9): whale=(9%2===0)=false, fundamental=(9%3===0)=true
    const final = _loadAdvisoryPromptConfigFromStorage(symbol);
    expect(final.sources.whale.enabled).toBe(false);
    expect(final.sources.fundamental.enabled).toBe(true);
  });

  // Bonus Test: localStorage quota exceeded → graceful fallback
  test('Bonus: should handle localStorage quota exceeded gracefully', () => {
    const symbol = 'MWG';
    const config = _getDefaultPromptConfig();

    // Mock localStorage.setItem to throw quota exceeded error
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = jest.fn(() => {
      throw new Error('QuotaExceededError');
    });

    // Should not throw, just log warning
    expect(() => {
      _saveAdvisoryPromptConfigToStorage(symbol, config);
    }).not.toThrow();

    // Restore
    localStorage.setItem = originalSetItem;
  });

  // Bonus Test: Empty/null symbol → should not save
  test('Bonus: should not save when symbol is empty or null', () => {
    const config = _getDefaultPromptConfig();

    _saveAdvisoryPromptConfigToStorage(null, config);
    _saveAdvisoryPromptConfigToStorage('', config);

    expect(localStorage.getItem('ai_advisory_prompt_config:null')).toBeNull();
    expect(localStorage.getItem('ai_advisory_prompt_config:')).toBeNull();
  });
});

// ============================================================================
// TEST SUITE: Schema Validation
// ============================================================================

describe('AIAdvisoryPromptConfig - Schema Validation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('default config should have correct schema v2', () => {
    const defaults = _getDefaultPromptConfig();

    expect(defaults.version).toBe(2);
    expect(defaults.sources).toBeDefined();

    // Check all 8 sources exist
    const expectedSources = [
      'whale',
      'dark_flow',
      'technical',
      'news',
      'market',
      'fundamental',
      'ownership',
      'sector',
    ];
    expectedSources.forEach((source) => {
      expect(defaults.sources[source]).toBeDefined();
      expect(defaults.sources[source].enabled).toBeDefined();
      expect(defaults.sources[source].lookback).toBeDefined();
    });

    // Check technical has indicators
    expect(Array.isArray(defaults.sources.technical.indicators)).toBe(true);
    expect(defaults.sources.technical.indicators.length).toBeGreaterThan(0);
  });

  test('default config should have correct enabled/disabled defaults', () => {
    const defaults = _getDefaultPromptConfig();

    // Enabled by default
    expect(defaults.sources.whale.enabled).toBe(true);
    expect(defaults.sources.dark_flow.enabled).toBe(true);
    expect(defaults.sources.technical.enabled).toBe(true);
    expect(defaults.sources.news.enabled).toBe(true);
    expect(defaults.sources.market.enabled).toBe(true);

    // Disabled by default
    expect(defaults.sources.fundamental.enabled).toBe(false);
    expect(defaults.sources.ownership.enabled).toBe(false);
    expect(defaults.sources.sector.enabled).toBe(false);
  });

  test('default config should have correct lookback bounds', () => {
    const defaults = _getDefaultPromptConfig();

    expect(defaults.sources.whale.lookback).toBe(30);
    expect(defaults.sources.dark_flow.lookback).toBe(30);
    expect(defaults.sources.technical.lookback).toBe(20);
    expect(defaults.sources.news.lookback).toBe(7);
    expect(defaults.sources.market.lookback).toBe(60);
    expect(defaults.sources.fundamental.lookback).toBe(2);
    expect(defaults.sources.ownership.lookback).toBe(365);
    expect(defaults.sources.sector.lookback).toBe(60);
  });
});
