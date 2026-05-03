import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import UserConfig from './UserConfig';
import { useI18n } from '../context/LangContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useInterface } from '../context/InterfaceContext';
import * as client from '../api/client';

// Mock dependencies
jest.mock('../context/LangContext');
jest.mock('../context/PortfolioContext');
jest.mock('../context/InterfaceContext');
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
    'settings.movedTitle': 'AI settings moved to AI Command Center',
    'settings.movedDescription': 'Provider, model, API key, and prompt config are now managed centrally in AI Command Center.',
    'settings.openAiCommandCenter': 'Mở AI Command Center',
    'settings.generalOnlyNotice': 'This page keeps general preferences and the event-based advisory gate. Provider, model, and API key stay in AI Command Center.',
    'settings.eventBasedAuto': 'Enable event-based auto advisory',
    'settings.eventBasedAutoHelp': 'Controls auto advisory creation from whale, dark flow, and reversal events.',
    'settings.eventBasedAutoStateOn': 'Event-based advisory is on',
    'settings.eventBasedAutoStateOff': 'Event-based advisory is off',
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
  advisory_whale_signal_enabled: false,
};

describe('UserConfig', () => {
  const getLanguageSelect = () => screen.getByLabelText('Language');
  const renderUserConfig = () => render(
    <MemoryRouter>
      <UserConfig />
    </MemoryRouter>,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    useI18n.mockReturnValue(mockI18nContext);
    usePortfolio.mockReturnValue({ isAuthenticated: true });
    useInterface.mockReturnValue({ uiMode: 'modern', setUiMode: jest.fn() });
    client.getPortfolioUserConfig.mockResolvedValue({ data: mockUserConfig });
    client.updatePortfolioUserConfig.mockResolvedValue({ data: mockUserConfig });
  });

  it('renders loading state initially', () => {
    renderUserConfig();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('loads and displays all config fields', async () => {
    renderUserConfig();

    await waitFor(() => {
      expect(getLanguageSelect()).toHaveValue('vi');
    });

    // Verify general settings are loaded
    expect(screen.getByDisplayValue('500')).toBeInTheDocument(); // whale threshold
    expect(screen.getByLabelText('settings.theme')).toHaveValue('dark'); // theme
    expect(screen.getByLabelText('Enable event-based auto advisory')).not.toBeChecked();
  });

  it('persists language setting after save', async () => {
    renderUserConfig();

    await waitFor(() => {
      expect(getLanguageSelect()).toHaveValue('vi');
    });

    const languageSelect = getLanguageSelect();
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
    renderUserConfig();

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

  it('displays error message on save failure', async () => {
    client.updatePortfolioUserConfig.mockRejectedValue({
      response: {
        data: {
          detail: 'Failed to update settings',
        },
      },
    });

    renderUserConfig();

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

  it('shows AI Command Center handoff link', async () => {
    renderUserConfig();

    await waitFor(() => {
      expect(screen.getByDisplayValue('500')).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: 'Mở AI Command Center' })).toHaveAttribute(
      'href',
      '/settings/ai',
    );
  });

  it('shows event-based advisory gate near AI handoff', async () => {
    renderUserConfig();

    await waitFor(() => {
      expect(getLanguageSelect()).toHaveValue('vi');
    });

    expect(screen.getByLabelText('Enable event-based auto advisory')).toBeInTheDocument();
    expect(screen.getByText('Event-based advisory is off')).toBeInTheDocument();
  });

  it('persists event-based advisory gate after save', async () => {
    renderUserConfig();

    await waitFor(() => {
      expect(screen.getByLabelText('Enable event-based auto advisory')).not.toBeChecked();
    });

    fireEvent.click(screen.getByLabelText('Enable event-based auto advisory'));
    fireEvent.click(screen.getAllByText('Save')[0]);

    await waitFor(() => {
      expect(client.updatePortfolioUserConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          advisory_whale_signal_enabled: true,
        }),
      );
    });
  });

  it('handles data reload after page refresh simulation', async () => {
    const { unmount } = renderUserConfig();

    await waitFor(() => {
      expect(getLanguageSelect()).toHaveValue('vi');
    });

    // Simulate page reload by unmounting and mounting again
    jest.clearAllMocks();
    client.getPortfolioUserConfig.mockResolvedValue({ data: mockUserConfig });

    unmount();
    renderUserConfig();

    // Data should reload on mount
    await waitFor(() => {
      expect(client.getPortfolioUserConfig).toHaveBeenCalled();
      expect(screen.getByDisplayValue('500')).toBeInTheDocument();
    });
  });

  it('validates minimum whale threshold', async () => {
    renderUserConfig();

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
          whale_alert_threshold: 500, // keep previous valid value when invalid input (0)
        })
      );
    });
  });

  it('shows success message after save', async () => {
    renderUserConfig();

    await waitFor(() => {
      expect(screen.getByDisplayValue('500')).toBeInTheDocument();
    });

    const saveButton = screen.getAllByText('Save')[0];
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Save', { selector: 'p' })).toBeInTheDocument();
    });
  });
});
