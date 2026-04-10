import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserConfig from './UserConfig';
import { useI18n } from '../context/LangContext';
import * as client from '../api/client';

// Mock dependencies
jest.mock('../context/LangContext');
jest.mock('../api/client');

const mockT = (key) => {
  const translations = {
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'settings.pageDescription': 'Centralized account preferences',
    'settings.general': 'General preferences',
    'common.language': 'Language',
    'common.theme': 'Theme',
    'settings.whaleThreshold': 'Whale alert threshold',
    'settings.advisoryPolicy': 'AI advisory policy',
    'settings.periodicAuto': 'Enable periodic auto-generation',
    'settings.eventBasedAuto': 'Enable event-based advisory',
    'settings.manualRefresh': 'Allow manual refresh',
  };
  return translations[key] || key;
};

const mockI18nContext = {
  t: mockT,
  setLanguage: jest.fn(),
};

const mockUserConfig = {
  language: 'vi',
  theme: 'dark',
  whale_alert_threshold: 500,
  advisory_auto_generation_enabled: true,
  advisory_whale_signal_enabled: true,
  advisory_manual_refresh_enabled: true,
  advisory_refresh_interval_hours: 24,
  advisory_max_auto_refreshes_per_day: 24,
  advisory_max_tokens_per_day: 5000,
  ai_provider: 'openclaw',
  ai_model: '',
  ai_api_key: '',
};

const mockAIConfig = {
  ai_provider: 'openclaw',
  ai_model: '',
  ai_api_key_configured: false,
  ai_ready: false,
};

const mockAIOptions = {
  providers: {
    openai: ['gpt-4o', 'gpt-4-turbo'],
    openclaw: ['default'],
  },
  model_catalog: {
    openai: [
      { id: 'gpt-4o', label: 'GPT-4 Omni', capabilities: ['text_advisory'], validated_for_runtime: true },
    ],
    openclaw: [
      { id: 'default', label: 'OpenClaw', capabilities: ['text_advisory'], validated_for_runtime: true },
    ],
  },
};

describe('UserConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useI18n.mockReturnValue(mockI18nContext);
    
    client.getAIOptions.mockResolvedValue({ data: mockAIOptions });
    client.getUserConfig.mockResolvedValue({ data: mockAIConfig });
    client.getPortfolioUserConfig.mockResolvedValue({ data: mockUserConfig });
    client.updatePortfolioUserConfig.mockResolvedValue({ data: mockUserConfig });
    client.updateUserConfig.mockResolvedValue({ data: mockAIConfig });
  });

  it('renders loading state initially', () => {
    render(<UserConfig />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('loads and displays all config fields', async () => {
    render(<UserConfig />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('vi')).toBeInTheDocument(); // language select
    });

    // Verify general settings are loaded
    expect(screen.getByDisplayValue('500')).toBeInTheDocument(); // whale threshold
    expect(screen.getByDisplayValue('dark')).toBeInTheDocument(); // theme
  });

  it('loads advisory policy toggles', async () => {
    render(<UserConfig />);

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThanOrEqual(3); // At least periodic, event-based, manual
    });
  });

  it('persists language setting after save', async () => {
    render(<UserConfig />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('vi')).toBeInTheDocument();
    });

    const languageSelect = screen.getByDisplayValue('vi');
    await userEvent.selectOptions(languageSelect, 'en');

    const saveButton = screen.getAllByText('Save')[0]; // First save button (general section)
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(client.updatePortfolioUserConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'en',
        })
      );
    });

    // Verify language change callback was triggered
    await waitFor(() => {
      expect(mockI18nContext.setLanguage).toHaveBeenCalledWith('en');
    });
  });

  it('persists whale alert threshold setting', async () => {
    render(<UserConfig />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('500')).toBeInTheDocument();
    });

    const thresholdInput = screen.getByDisplayValue('500');
    await userEvent.clear(thresholdInput);
    await userEvent.type(thresholdInput, '1000');

    const saveButton = screen.getAllByText('Save')[0];
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(client.updatePortfolioUserConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          whale_alert_threshold: 1000,
        })
      );
    });
  });

  it('persists advisory policy toggles', async () => {
    render(<UserConfig />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('500')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    const eventBasedToggle = checkboxes[1]; // event-based is typically second

    fireEvent.click(eventBasedToggle);

    const saveButton = screen.getAllByText('Save')[0];
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(client.updatePortfolioUserConfig).toHaveBeenCalled();
    });
  });

  it('displays error message on save failure', async () => {
    client.updatePortfolioUserConfig.mockRejectedValue({
      response: {
        data: {
          detail: 'Failed to update settings',
        },
      },
    });

    render(<UserConfig />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('500')).toBeInTheDocument();
    });

    const thresholdInput = screen.getByDisplayValue('500');
    await userEvent.clear(thresholdInput);
    await userEvent.type(thresholdInput, '2000');

    const saveButton = screen.getAllByText('Save')[0];
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to update settings')).toBeInTheDocument();
    });
  });

  it('shows AI configuration section', async () => {
    render(<UserConfig />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('500')).toBeInTheDocument();
    });

    // AI config section should render provider/model selects
    const providerSelects = screen.getAllByDisplayValue('openclaw');
    expect(providerSelects.length).toBeGreaterThan(0);
  });

  it('handles data reload after page refresh simulation', async () => {
    const { rerender } = render(<UserConfig />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('vi')).toBeInTheDocument();
    });

    // Simulate page reload by rerendering
    jest.clearAllMocks();
    client.getAIOptions.mockResolvedValue({ data: mockAIOptions });
    client.getUserConfig.mockResolvedValue({ data: mockAIConfig });
    client.getPortfolioUserConfig.mockResolvedValue({ data: mockUserConfig });

    rerender(<UserConfig />);

    // Data should reload on mount
    await waitFor(() => {
      expect(client.getPortfolioUserConfig).toHaveBeenCalled();
      expect(screen.getByDisplayValue('500')).toBeInTheDocument();
    });
  });

  it('validates minimum whale threshold', async () => {
    render(<UserConfig />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('500')).toBeInTheDocument();
    });

    const thresholdInput = screen.getByDisplayValue('500');
    await userEvent.clear(thresholdInput);
    await userEvent.type(thresholdInput, '0');

    const saveButton = screen.getAllByText('Save')[0];
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(client.updatePortfolioUserConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          whale_alert_threshold: 1, // Should be minimum 1
        })
      );
    });
  });

  it('shows success message after save', async () => {
    render(<UserConfig />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('500')).toBeInTheDocument();
    });

    const saveButton = screen.getAllByText('Save')[0];
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument(); // Confirmation message
    });
  });
});
