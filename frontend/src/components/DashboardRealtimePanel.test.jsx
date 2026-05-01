import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import DashboardRealtimePanel from './DashboardRealtimePanel';

const mockUseI18n = jest.fn();
const mockUseUnifiedAlerts = jest.fn();
const mockUsePersistentAlertState = jest.fn();
const mockGetRealtimeHealth = jest.fn();

jest.mock('../context/LangContext', () => ({
  useI18n: () => mockUseI18n(),
}));

jest.mock('../hooks/useUnifiedAlerts', () => ({
  __esModule: true,
  default: (...args) => mockUseUnifiedAlerts(...args),
  normalizeAlertText: (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      return value.message || value.detail || value.description || value.headline || value.title || JSON.stringify(value);
    }
    return String(value);
  },
  normalizeSeverity: (value, fallback = 'medium') => value || fallback,
}));

jest.mock('../hooks/usePersistentAlertState', () => () => mockUsePersistentAlertState());

jest.mock('../api/client', () => ({
  getRealtimeHealth: (...args) => mockGetRealtimeHealth(...args),
}));

jest.mock('./AllocationPieChart', () => () => <div data-testid="allocation-pie-chart" />);
jest.mock('./RealtimeQuoteTable', () => ({
  RealtimeQuoteTable: () => <div data-testid="realtime-quote-table" />,
  COLUMN_PRESETS: {},
}));

describe('DashboardRealtimePanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseI18n.mockReturnValue({
      t: (key, params) => params?.defaultValue || key,
      formatNumber: (value) => String(value),
      formatTime: () => '12:00',
      formatDateTime: () => '01/05/2026 12:00:00',
      formatQuoteInteger: (value) => String(value),
    });
    mockUsePersistentAlertState.mockReturnValue({
      readAlertIds: new Set(),
      criticalSoundEnabled: false,
      markAlertAsRead: jest.fn(),
      isMutedSymbol: jest.fn(() => false),
      muteSymbolFor30m: jest.fn(),
      toggleCriticalSound: jest.fn(),
    });
    mockGetRealtimeHealth.mockResolvedValue({ data: { ok: true } });
    mockUseUnifiedAlerts.mockReturnValue({
      quoteList: [],
      filteredUnifiedAlerts: [
        {
          id: 'alert-1',
          symbol: 'FPT',
          severity: 'critical',
          source: 'whale',
          type: 'buy',
          ts: '2026-05-01T10:00:00Z',
          headline: {
            message: 'Tiêu đề cảnh báo object',
          },
          detail: {
            description: 'Mô tả cảnh báo object',
          },
        },
      ],
      alertSummary: { critical: 1, high: 0, medium: 0, low: 0 },
      hotSymbols: [],
      backendUnifiedHasMore: false,
      loadingMoreUnified: false,
      loadMoreUnifiedSnapshot: jest.fn(),
    });
  });

  it('renders object-shaped alert text without leaking raw objects', async () => {
    render(
      <MemoryRouter>
        <DashboardRealtimePanel
          holdings={[]}
          trackedSymbolNames={[]}
          quotesBySymbol={{}}
          realtimeStatus="live"
          lastEventAt="2026-05-01T10:00:00Z"
          alerts={[]}
          darkFlowAlerts={[]}
          metrics={null}
          monitoredSymbols={[]}
          enableSnapshot
          onSyncRequest={null}
          showSummaryMetrics={false}
          portfolioId={null}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Tiêu đề cảnh báo object').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText('Mô tả cảnh báo object')).toBeTruthy();
    expect(screen.queryByText('[object Object]')).toBeNull();
  });
});