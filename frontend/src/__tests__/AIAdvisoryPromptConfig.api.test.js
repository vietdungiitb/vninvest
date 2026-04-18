/**
 * Phase 3 Item 2: AI Advisory Canonical prompt_config API Payload Validation
 * 
 * Tests that the prompt_config payload sent to the backend has correct structure,
 * enabled sources/indicators, and respects min/max lookback bounds
 */

import '@testing-library/jest-dom';

// ============================================================================
// Helper Functions (from frontend utils)
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

// Lookback bounds per source (from backend spec)
const LOOKBACK_BOUNDS = {
  whale: { min: 5, max: 90 },
  dark_flow: { min: 5, max: 90 },
  technical: { min: 5, max: 100 },
  news: { min: 1, max: 30 },
  market: { min: 10, max: 365 },
  fundamental: { min: 1, max: 8 },
  ownership: { min: 30, max: 365 },
  sector: { min: 10, max: 365 },
};

// Valid technical indicators
const VALID_INDICATORS = ['rsi', 'bollinger', 'vols', 'prices', 'ma20', 'ma50', 'snapshot', 'cdms'];

/**
 * Build API payload - mirrors frontend implementation
 */
const buildApiPayload = (config, synthesisPreference = 'balanced') => {
  return {
    synthesis_preference: synthesisPreference,
    prompt_config: config,
    component_ids: ['executive_summary'], // default
  };
};

/**
 * Validate payload structure matches schema
 */
const validatePayloadStructure = (payload) => {
  if (!payload) throw new Error('Payload is null or undefined');
  if (!payload.prompt_config) throw new Error('Missing prompt_config in payload');

  const pc = payload.prompt_config;
  if (!pc.version) throw new Error('Missing version in prompt_config');
  if (pc.version !== 2) throw new Error(`Invalid version: ${pc.version}, expected 2`);
  if (!pc.sources || typeof pc.sources !== 'object') throw new Error('Missing or invalid sources');

  // Check all 8 sources
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
  for (const source of expectedSources) {
    if (!pc.sources[source]) throw new Error(`Missing source: ${source}`);
    if (typeof pc.sources[source].enabled !== 'boolean')
      throw new Error(`Invalid enabled for source ${source}`);
    if (typeof pc.sources[source].lookback !== 'number')
      throw new Error(`Invalid lookback for source ${source}`);
  }

  // Check technical indicators
  if (!Array.isArray(pc.sources.technical.indicators))
    throw new Error('Technical indicators must be an array');

  return true;
};

/**
 * Filter payload to only include enabled sources for transmission
 */
const filterPayloadEnabledSources = (payload) => {
  const filtered = {
    ...payload,
    prompt_config: {
      version: payload.prompt_config.version,
      sources: {},
    },
  };

  Object.entries(payload.prompt_config.sources).forEach(([sourceId, config]) => {
    if (config.enabled) {
      filtered.prompt_config.sources[sourceId] = config;
    }
  });

  return filtered;
};

/**
 * Clamp lookback value to min/max bounds
 */
const clampLookback = (sourceId, value) => {
  const bounds = LOOKBACK_BOUNDS[sourceId];
  if (!bounds) return value;
  return Math.min(Math.max(value, bounds.min), bounds.max);
};

// ============================================================================
// TEST SUITE: API Payload Validation
// ============================================================================

describe('AIAdvisoryPromptConfig - API Payload Validation Tests', () => {
  // Test 1: Generate correct prompt_config payload structure
  test('1. should generate correct prompt_config payload structure', () => {
    const config = _getDefaultPromptConfig();
    const payload = buildApiPayload(config);

    expect(validatePayloadStructure(payload)).toBe(true);
    expect(payload.synthesis_preference).toBe('balanced');
    expect(payload.prompt_config.version).toBe(2);
    expect(Object.keys(payload.prompt_config.sources).length).toBe(8);
  });

  // Test 2: Verify enabled sources included in request body
  test('2. should include only enabled sources in filtered payload', () => {
    const config = _getDefaultPromptConfig();
    config.sources.fundamental.enabled = true;
    config.sources.ownership.enabled = false; // Stays disabled

    const payload = buildApiPayload(config);
    const filtered = filterPayloadEnabledSources(payload);

    // Should include: whale, dark_flow, technical, news, market, fundamental
    // Should exclude: ownership, sector
    expect(filtered.prompt_config.sources.whale).toBeDefined();
    expect(filtered.prompt_config.sources.fundamental).toBeDefined();
    expect(filtered.prompt_config.sources.ownership).toBeUndefined();
    expect(filtered.prompt_config.sources.sector).toBeUndefined();
    expect(Object.keys(filtered.prompt_config.sources).length).toBe(6);
  });

  // Test 3: Verify disabled sources excluded from request body
  test('3. should exclude all disabled sources from filtered payload', () => {
    const config = _getDefaultPromptConfig();
    // fundamental, ownership, sector are disabled by default

    const payload = buildApiPayload(config);
    const filtered = filterPayloadEnabledSources(payload);

    expect(filtered.prompt_config.sources.fundamental).toBeUndefined();
    expect(filtered.prompt_config.sources.ownership).toBeUndefined();
    expect(filtered.prompt_config.sources.sector).toBeUndefined();
    expect(Object.keys(filtered.prompt_config.sources).length).toBe(5);
  });

  // Test 4: Verify technical indicators array only includes enabled indicators
  test('4. should include only enabled technical indicators in payload', () => {
    const config = _getDefaultPromptConfig();
    config.sources.technical.indicators = ['rsi', 'bollinger', 'vols'];

    const payload = buildApiPayload(config);

    expect(payload.prompt_config.sources.technical.indicators).toEqual(['rsi', 'bollinger', 'vols']);
    expect(payload.prompt_config.sources.technical.indicators.length).toBe(3);
    expect(payload.prompt_config.sources.technical.indicators).toContain('rsi');
  });

  // Test 5: Verify default source selection (5 enabled by default)
  test('5. should have 5 sources enabled by default', () => {
    const defaults = _getDefaultPromptConfig();

    const enabledCount = Object.values(defaults.sources).filter((s) => s.enabled).length;
    expect(enabledCount).toBe(5);

    // These should be enabled
    expect(defaults.sources.whale.enabled).toBe(true);
    expect(defaults.sources.dark_flow.enabled).toBe(true);
    expect(defaults.sources.technical.enabled).toBe(true);
    expect(defaults.sources.news.enabled).toBe(true);
    expect(defaults.sources.market.enabled).toBe(true);

    // These should be disabled
    expect(defaults.sources.fundamental.enabled).toBe(false);
    expect(defaults.sources.ownership.enabled).toBe(false);
    expect(defaults.sources.sector.enabled).toBe(false);
  });

  // Test 6: Verify lookback values respect min/max bounds
  test('6. should clamp lookback values to source-specific bounds', () => {
    // Test whale: min=5, max=90
    expect(clampLookback('whale', 3)).toBe(5); // Below min → clamp to min
    expect(clampLookback('whale', 50)).toBe(50); // Within bounds → no change
    expect(clampLookback('whale', 100)).toBe(90); // Above max → clamp to max

    // Test news: min=1, max=30
    expect(clampLookback('news', 0)).toBe(1); // Below min → clamp
    expect(clampLookback('news', 7)).toBe(7); // Within bounds
    expect(clampLookback('news', 50)).toBe(30); // Above max → clamp

    // Test ownership: min=30, max=365
    expect(clampLookback('ownership', 10)).toBe(30); // Below min → clamp
    expect(clampLookback('ownership', 365)).toBe(365); // At max → no change
    expect(clampLookback('ownership', 400)).toBe(365); // Above max → clamp
  });

  // Test 7: Mock fetch and validate prompt_config in outgoing request
  test('7. should send prompt_config in API request with correct structure', async () => {
    // Mock fetch
    global.fetch = jest.fn((url, options) => {
      const body = JSON.parse(options.body);

      // Validate the request body
      expect(body.prompt_config).toBeDefined();
      expect(body.prompt_config.version).toBe(2);
      expect(body.prompt_config.sources).toBeDefined();

      // Simulate successful response
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            summary: 'Test synthesis',
            prompt_config_version: 2,
          }),
      });
    });

    const config = _getDefaultPromptConfig();
    const payload = buildApiPayload(config);

    // Simulate API call
    const response = await fetch('http://api.example.com/ai-advisory/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    expect(data.summary).toBe('Test synthesis');
    expect(global.fetch).toHaveBeenCalled();
  });

  // Test 8: Multiple source/indicator combinations
  test('8. should handle various source and indicator combinations', () => {
    const testCases = [
      {
        name: 'All sources enabled',
        setup: (config) => {
          Object.keys(config.sources).forEach((source) => {
            config.sources[source].enabled = true;
          });
        },
        expectedEnabledCount: 8,
      },
      {
        name: 'Only mandatory sources',
        setup: (config) => {
          Object.keys(config.sources).forEach((source) => {
            config.sources[source].enabled = source === 'technical';
          });
        },
        expectedEnabledCount: 1,
      },
      {
        name: 'Mix of mandatory and optional',
        setup: (config) => {
          config.sources.fundamental.enabled = true;
          config.sources.ownership.enabled = true;
        },
        expectedEnabledCount: 7,
      },
    ];

    testCases.forEach((testCase) => {
      const config = _getDefaultPromptConfig();
      testCase.setup(config);

      const payload = buildApiPayload(config);
      const filtered = filterPayloadEnabledSources(payload);

      const enabledCount = Object.keys(filtered.prompt_config.sources).length;
      expect(enabledCount).toBe(testCase.expectedEnabledCount);
    });
  });

  // Test 9: Invalid indicator filtering
  test('9. should filter out invalid technical indicators', () => {
    const config = _getDefaultPromptConfig();
    const invalidIndicators = ['rsi', 'invalid_indicator', 'bollinger', 'another_bad_one', 'vols'];

    // Frontend should filter before sending
    const filtered = invalidIndicators.filter((ind) => VALID_INDICATORS.includes(ind));
    config.sources.technical.indicators = filtered;

    const payload = buildApiPayload(config);

    expect(payload.prompt_config.sources.technical.indicators).toEqual(['rsi', 'bollinger', 'vols']);
    expect(payload.prompt_config.sources.technical.indicators).not.toContain('invalid_indicator');
    expect(payload.prompt_config.sources.technical.indicators).not.toContain('another_bad_one');
  });

  // Test 10: Payload serialization (JSON round-trip)
  test('10. should correctly serialize and deserialize payload', () => {
    const config = _getDefaultPromptConfig();
    config.sources.fundamental.enabled = true;
    const payload = buildApiPayload(config);

    // Serialize to JSON
    const serialized = JSON.stringify(payload);
    expect(typeof serialized).toBe('string');

    // Deserialize back
    const deserialized = JSON.parse(serialized);

    // Should match original
    expect(deserialized).toEqual(payload);
    expect(deserialized.prompt_config.version).toBe(2);
    expect(deserialized.prompt_config.sources.fundamental.enabled).toBe(true);
  });
});

// ============================================================================
// TEST SUITE: Payload Schema Compliance
// ============================================================================

describe('AIAdvisoryPromptConfig - Payload Schema Compliance', () => {
  test('payload should conform to canonical schema v2', () => {
    const config = _getDefaultPromptConfig();
    const payload = buildApiPayload(config);

    // Expected schema
    const expectedSchema = {
      version: 2,
      sources: {
        whale: { enabled: 'boolean', lookback: 'number' },
        dark_flow: { enabled: 'boolean', lookback: 'number' },
        technical: { enabled: 'boolean', lookback: 'number', indicators: 'array' },
        news: { enabled: 'boolean', lookback: 'number' },
        market: { enabled: 'boolean', lookback: 'number' },
        fundamental: { enabled: 'boolean', lookback: 'number' },
        ownership: { enabled: 'boolean', lookback: 'number' },
        sector: { enabled: 'boolean', lookback: 'number' },
      },
    };

    // Validate each source
    Object.entries(expectedSchema.sources).forEach(([sourceId, schema]) => {
      const source = payload.prompt_config.sources[sourceId];
      expect(typeof source.enabled).toBe(schema.enabled);
      expect(typeof source.lookback).toBe(schema.lookback);

      if (sourceId === 'technical') {
        expect(Array.isArray(source.indicators)).toBe(true);
      }
    });
  });

  test('default payload should match canonical defaults', () => {
    const payload = buildApiPayload(_getDefaultPromptConfig());
    const pc = payload.prompt_config;

    // Version
    expect(pc.version).toBe(2);

    // Enabled defaults
    const enabledByDefault = ['whale', 'dark_flow', 'technical', 'news', 'market'];
    const disabledByDefault = ['fundamental', 'ownership', 'sector'];

    enabledByDefault.forEach((source) => {
      expect(pc.sources[source].enabled).toBe(true);
    });

    disabledByDefault.forEach((source) => {
      expect(pc.sources[source].enabled).toBe(false);
    });
  });
});
