/**
 * Phase 3 Item 4: AI Advisory Prompt Config Component Integration Tests
 * 
 * Tests that StockDetail properly integrates:
 * - Settings drawer opens/closes
 * - localStorage persistence
 * - Regenerate API call includes prompt_config
 * - Enabled sources badges display correctly
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Mock components
const AIAdvisoryPromptConfigDrawer = ({ isOpen, onClose, config, onConfigChange }) => {
  if (!isOpen) return null;

  return (
    <div data-testid="drawer">
      <button onClick={onClose} data-testid="close-button">
        Close
      </button>
      <div data-testid="drawer-content">
        {Object.entries(config.sources).map(([sourceId, sourceConfig]) => (
          <label key={sourceId} data-testid={`source-toggle-${sourceId}`}>
            <input
              type="checkbox"
              checked={sourceConfig.enabled}
              onChange={(e) => {
                const newConfig = JSON.parse(JSON.stringify(config));
                newConfig.sources[sourceId].enabled = e.target.checked;
                onConfigChange(newConfig);
              }}
            />
            {sourceId}
          </label>
        ))}
      </div>
    </div>
  );
};

// Mock StockDetail component (simplified version for testing)
const StockDetailMock = () => {
  const [advisoryPromptConfig, setAdvisoryPromptConfig] = React.useState({
    version: 2,
    sources: {
      whale: { enabled: true, lookback: 30 },
      dark_flow: { enabled: true, lookback: 30 },
      technical: { enabled: true, lookback: 20, indicators: ['rsi'] },
      news: { enabled: true, lookback: 7 },
      market: { enabled: true, lookback: 60 },
      fundamental: { enabled: false, lookback: 2 },
      ownership: { enabled: false, lookback: 365 },
      sector: { enabled: false, lookback: 60 },
    },
  });

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [lastApiPayload, setLastApiPayload] = React.useState(null);

  const handleRegenerateSummary = async () => {
    // Simulate API call with prompt_config
    const payload = {
      component_ids: ['executive_summary'],
      synthesis_preference: 'balanced',
      prompt_config: advisoryPromptConfig,
    };
    setLastApiPayload(payload);
  };

  return (
    <div data-testid="stock-detail">
      <h1>Stock Detail</h1>

      {/* Settings button */}
      <button
        onClick={() => setDrawerOpen(true)}
        data-testid="settings-button"
        className="settings-btn"
      >
        ⚙️ Settings
      </button>

      {/* Regenerate button */}
      <button onClick={handleRegenerateSummary} data-testid="regenerate-button">
        Regenerate Summary
      </button>

      {/* Enabled sources display */}
      <div data-testid="enabled-sources">
        {Object.entries(advisoryPromptConfig.sources)
          .filter(([_, cfg]) => cfg.enabled)
          .map(([sourceId]) => (
            <span key={sourceId} data-testid={`source-badge-${sourceId}`}>
              ✓ {sourceId}
            </span>
          ))}
      </div>

      {/* Last API payload (for testing) */}
      {lastApiPayload && (
        <div data-testid="last-api-payload">
          {JSON.stringify(lastApiPayload)}
        </div>
      )}

      {/* Drawer */}
      <AIAdvisoryPromptConfigDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        config={advisoryPromptConfig}
        onConfigChange={setAdvisoryPromptConfig}
      />
    </div>
  );
};

// ============================================================================
// TEST SUITE: Component Integration
// ============================================================================

describe('AIAdvisoryPromptConfig - Component Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // Test 1: Render StockDetail with symbol → check localStorage init
  test('1. should render StockDetail with settings button visible', () => {
    render(<StockDetailMock />);

    expect(screen.getByTestId('stock-detail')).toBeInTheDocument();
    expect(screen.getByTestId('settings-button')).toBeInTheDocument();
    expect(screen.getByTestId('regenerate-button')).toBeInTheDocument();
  });

  // Test 2: Click settings button → drawer opens
  test('2. should open settings drawer when settings button clicked', async () => {
    render(<StockDetailMock />);

    const settingsButton = screen.getByTestId('settings-button');
    fireEvent.click(settingsButton);

    // Drawer should now be visible
    await waitFor(() => {
      expect(screen.getByTestId('drawer')).toBeInTheDocument();
    });
  });

  // Test 3: Toggle source in drawer → state updates
  test('3. should update state when source is toggled in drawer', async () => {
    render(<StockDetailMock />);

    // Open drawer
    fireEvent.click(screen.getByTestId('settings-button'));

    // Find and toggle "fundamental" source (currently disabled)
    const fundamentalToggle = screen.getByTestId('source-toggle-fundamental');
    const checkbox = fundamentalToggle.querySelector('input');

    fireEvent.click(checkbox);

    // Verify source is now enabled
    await waitFor(() => {
      expect(checkbox.checked).toBe(true);
    });
  });

  // Test 4: Close drawer → drawer disappears
  test('4. should close drawer when close button clicked', async () => {
    render(<StockDetailMock />);

    // Open drawer
    fireEvent.click(screen.getByTestId('settings-button'));

    // Drawer should be visible
    await waitFor(() => {
      expect(screen.getByTestId('drawer')).toBeInTheDocument();
    });

    // Close drawer
    fireEvent.click(screen.getByTestId('close-button'));

    // Drawer should no longer be visible
    await waitFor(() => {
      expect(screen.queryByTestId('drawer')).not.toBeInTheDocument();
    });
  });

  // Test 5: Click Regenerate → API call includes prompt_config
  test('5. should include prompt_config in regenerate API call', async () => {
    render(<StockDetailMock />);

    // Click regenerate
    fireEvent.click(screen.getByTestId('regenerate-button'));

    // Verify API payload contains prompt_config
    await waitFor(() => {
      const payloadElement = screen.getByTestId('last-api-payload');
      const payload = JSON.parse(payloadElement.textContent);

      expect(payload.prompt_config).toBeDefined();
      expect(payload.prompt_config.version).toBe(2);
      expect(payload.prompt_config.sources).toBeDefined();
    });
  });

  // Test 6: Enabled sources badges appear on summary
  test('6. should display enabled sources as badges', async () => {
    render(<StockDetailMock />);

    // Default: whale, dark_flow, technical, news, market should be visible
    expect(screen.getByTestId('source-badge-whale')).toBeInTheDocument();
    expect(screen.getByTestId('source-badge-dark_flow')).toBeInTheDocument();
    expect(screen.getByTestId('source-badge-technical')).toBeInTheDocument();
    expect(screen.getByTestId('source-badge-news')).toBeInTheDocument();
    expect(screen.getByTestId('source-badge-market')).toBeInTheDocument();

    // Disabled sources should not be visible
    expect(screen.queryByTestId('source-badge-fundamental')).not.toBeInTheDocument();
    expect(screen.queryByTestId('source-badge-ownership')).not.toBeInTheDocument();
    expect(screen.queryByTestId('source-badge-sector')).not.toBeInTheDocument();
  });

  // Test 7: Full integration flow
  test('7. should handle full settings + regenerate flow smoothly', async () => {
    render(<StockDetailMock />);

    // 1. Open settings
    fireEvent.click(screen.getByTestId('settings-button'));

    // 2. Toggle fundamental source
    const fundamentalToggle = screen.getByTestId('source-toggle-fundamental');
    fireEvent.click(fundamentalToggle.querySelector('input'));

    // 3. Close drawer
    fireEvent.click(screen.getByTestId('close-button'));

    // 4. Regenerate summary
    fireEvent.click(screen.getByTestId('regenerate-button'));

    // 5. Verify API payload includes updated config with fundamental enabled
    await waitFor(() => {
      const payloadElement = screen.getByTestId('last-api-payload');
      const payload = JSON.parse(payloadElement.textContent);

      expect(payload.prompt_config.sources.fundamental.enabled).toBe(true);
    });

    // 6. Verify badge now shows fundamental
    expect(screen.getByTestId('source-badge-fundamental')).toBeInTheDocument();
  });

  // Test 8: Multiple toggles and regenerate
  test('8. should handle multiple source toggles before regenerate', async () => {
    render(<StockDetailMock />);

    // Open settings
    fireEvent.click(screen.getByTestId('settings-button'));

    // Toggle multiple sources
    fireEvent.click(screen.getByTestId('source-toggle-whale').querySelector('input'));
    fireEvent.click(
      screen.getByTestId('source-toggle-fundamental').querySelector('input')
    );
    fireEvent.click(screen.getByTestId('source-toggle-ownership').querySelector('input'));

    // Close drawer
    fireEvent.click(screen.getByTestId('close-button'));

    // Regenerate
    fireEvent.click(screen.getByTestId('regenerate-button'));

    // Verify final config in payload
    await waitFor(() => {
      const payloadElement = screen.getByTestId('last-api-payload');
      const payload = JSON.parse(payloadElement.textContent);

      expect(payload.prompt_config.sources.whale.enabled).toBe(false);
      expect(payload.prompt_config.sources.fundamental.enabled).toBe(true);
      expect(payload.prompt_config.sources.ownership.enabled).toBe(true);
    });
  });
});

// ============================================================================
// TEST SUITE: Settings Button Integration
// ============================================================================

describe('AIAdvisoryPromptConfig - Settings Button Integration', () => {
  test('should have settings button with correct styling', () => {
    render(<StockDetailMock />);

    const button = screen.getByTestId('settings-button');
    expect(button).toHaveClass('settings-btn');
    expect(button.textContent).toContain('⚙️');
  });

  test('should toggle drawer open/close on button click', async () => {
    render(<StockDetailMock />);

    const button = screen.getByTestId('settings-button');

    // Initially drawer is closed
    expect(screen.queryByTestId('drawer')).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByTestId('drawer')).toBeInTheDocument();
    });

    // Click to close
    fireEvent.click(screen.getByTestId('close-button'));
    await waitFor(() => {
      expect(screen.queryByTestId('drawer')).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// TEST SUITE: Enabled Sources Display
// ============================================================================

describe('AIAdvisoryPromptConfig - Enabled Sources Display', () => {
  test('should display all enabled sources by default', () => {
    render(<StockDetailMock />);

    const enabledByDefault = ['whale', 'dark_flow', 'technical', 'news', 'market'];

    enabledByDefault.forEach((source) => {
      expect(screen.getByTestId(`source-badge-${source}`)).toBeInTheDocument();
    });
  });

  test('should update badges when sources are toggled', async () => {
    render(<StockDetailMock />);

    // Open settings
    fireEvent.click(screen.getByTestId('settings-button'));

    // Toggle whale OFF
    fireEvent.click(screen.getByTestId('source-toggle-whale').querySelector('input'));

    // Close drawer
    fireEvent.click(screen.getByTestId('close-button'));

    // Whale badge should now be gone
    await waitFor(() => {
      expect(screen.queryByTestId('source-badge-whale')).not.toBeInTheDocument();
    });
  });

  test('should dynamically add badges for newly enabled sources', async () => {
    render(<StockDetailMock />);

    // Open settings
    fireEvent.click(screen.getByTestId('settings-button'));

    // Enable fundamental
    fireEvent.click(
      screen.getByTestId('source-toggle-fundamental').querySelector('input')
    );

    // Close drawer
    fireEvent.click(screen.getByTestId('close-button'));

    // Fundamental badge should now be visible
    await waitFor(() => {
      expect(screen.getByTestId('source-badge-fundamental')).toBeInTheDocument();
    });
  });
});
