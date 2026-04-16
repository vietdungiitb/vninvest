import React from 'react';
import RealtimeQuoteTable from './RealtimeQuoteTable';
import { COLUMN_PRESETS } from './columnPresets';

/**
 * Demo component for testing RealtimeQuoteTable
 * Shows all column preset configurations
 */
export default function RealtimeQuoteTableDemo() {
  // Mock data for testing
  const mockQuotes = [
    {
      symbol: 'MBB',
      current_price: 26600,
      change_pct: 1.25,
      change: 330,
      freshness_seconds: 2,
      stale: false,
      data_semantic: 'realtime',
      market_phase: 'am',
    },
    {
      symbol: 'CII',
      current_price: 19400,
      change_pct: -0.51,
      change: -100,
      freshness_seconds: 5,
      stale: false,
      data_semantic: 'realtime',
      market_phase: 'am',
    },
    {
      symbol: 'DIG',
      current_price: 14650,
      change_pct: 2.15,
      change: 310,
      freshness_seconds: 15,
      stale: false,
      data_semantic: 'realtime',
      market_phase: 'am',
    },
    {
      symbol: 'TPB',
      current_price: 16400,
      change_pct: 0,
      change: 0,
      freshness_seconds: 120,
      stale: true,
      data_semantic: 'last_session_close',
      market_phase: 'offhours',
    },
    {
      symbol: 'ACB',
      current_price: 23800,
      change_pct: -1.67,
      change: -410,
      freshness_seconds: 3,
      stale: false,
      data_semantic: 'realtime',
      market_phase: 'am',
    },
  ];

  const mockActions = [
    { key: 'view', label: '👁️', data: {} },
    { key: 'trade', label: '💱', data: {} },
  ];

  return (
    <div className="bg-gray-950 p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-100 mb-2">RealtimeQuoteTable Demo</h1>
        <p className="text-gray-400">Test component với memoized rows</p>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Dashboard Market Status</h2>
          <RealtimeQuoteTable
            quotes={mockQuotes}
            columns={COLUMN_PRESETS.DASHBOARD_MARKET_STATUS}
            maxHeight="300px"
            showHint={true}
            emptyMessage="Không có mã CK nào"
            onRowClick={(symbol) => console.log('Clicked:', symbol)}
            sortConfig={{ key: 'symbol', direction: 'asc' }}
          />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Watchlist Tracked Symbols</h2>
          <RealtimeQuoteTable
            quotes={mockQuotes}
            columns={COLUMN_PRESETS.WATCHLIST_TRACKED}
            maxHeight="350px"
            showHint={true}
            customRowActions={mockActions}
            onRowClick={(symbol) => console.log('Clicked:', symbol)}
            onAction={(symbol, action, data) => console.log('Action:', symbol, action, data)}
          />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Watchlist Groups</h2>
          <RealtimeQuoteTable
            quotes={mockQuotes.slice(0, 3)}
            columns={COLUMN_PRESETS.WATCHLIST_GROUPS}
            maxHeight="250px"
            showHint={true}
          />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Empty State</h2>
          <RealtimeQuoteTable
            quotes={[]}
            columns={COLUMN_PRESETS.DASHBOARD_MARKET_STATUS}
            emptyMessage="Danh sách trống"
          />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Loading State</h2>
          <RealtimeQuoteTable
            quotes={mockQuotes}
            columns={COLUMN_PRESETS.DASHBOARD_MARKET_STATUS}
            isLoading={true}
          />
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-400">
        <p>
          <strong>Notes:</strong>
        </p>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>Rows use React.memo to prevent unnecessary re-renders</li>
          <li>Custom comparison checks: price, change%, freshness, stale flag</li>
          <li>Sortable columns (click header to toggle)</li>
          <li>Configurable columns and custom renderers supported</li>
        </ul>
      </div>
    </div>
  );
}
