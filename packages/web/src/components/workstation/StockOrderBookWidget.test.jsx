/**
 * StockOrderBookWidget.test.jsx
 * Unit tests for the Order Book widget component
 */
import { jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { StockOrderBookWidget } from './StockOrderBookWidget.jsx';

describe('StockOrderBookWidget', () => {
  const mockOrderBook = {
    symbol: 'FPT',
    bids: [
      { price: 99999.95, volume: 6000, orders: 25 },
      { price: 99999.90, volume: 4500, orders: 18 },
      { price: 99999.85, volume: 3000, orders: 12 },
    ],
    asks: [
      { price: 100000.00, volume: 6000, orders: 30 },
      { price: 100000.05, volume: 4500, orders: 22 },
      { price: 100000.10, volume: 3000, orders: 15 },
    ],
    spread: 0.05,
    timestamp: new Date().toISOString(),
  };

  test('renders order book with bids and asks', () => {
    render(<StockOrderBookWidget orderBook={mockOrderBook} loading={false} error={null} onRefresh={jest.fn()} />);

    expect(screen.getByText('Sổ lệnh (Market Depth)')).toBeInTheDocument();
    expect(screen.getByText('Spread:')).toBeInTheDocument();
    expect(screen.getByText('0.05')).toBeInTheDocument();

    // Check bids
    expect(screen.getByText('99,999.95')).toBeInTheDocument();
    expect(screen.getByText('99,999.90')).toBeInTheDocument();
    expect(screen.getByText('99,999.85')).toBeInTheDocument();

    // Check asks
    expect(screen.getByText('100,000.00')).toBeInTheDocument();
    expect(screen.getByText('100,000.05')).toBeInTheDocument();
    expect(screen.getByText('100,000.10')).toBeInTheDocument();

    // Check volumes
    expect(screen.getByText('6K')).toBeInTheDocument(); // 6000 -> 6K
    expect(screen.getByText('4.5K')).toBeInTheDocument(); // 4500 -> 4.5K
    expect(screen.getByText('3K')).toBeInTheDocument(); // 3000 -> 3K

    // Check orders
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  test('renders loading skeleton when loading', () => {
    render(<StockOrderBookWidget orderBook={null} loading={true} error={null} onRefresh={jest.fn()} />);

    // Should show skeleton rows
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  test('renders error state with retry button', () => {
    const onRefresh = jest.fn();
    render(<StockOrderBookWidget orderBook={null} loading={false} error="Failed to load" onRefresh={onRefresh} />);

    expect(screen.getByText('Failed to load')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /thử lại/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /thử lại/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  test('shows color-blind friendly badges', () => {
    render(<StockOrderBookWidget orderBook={mockOrderBook} loading={false} error={null} onRefresh={jest.fn()} />);

    // Bid badge (▲ M)
    expect(screen.getByText('▲ M')).toBeInTheDocument();
    // Ask badge (▼ B)
    expect(screen.getByText('▼ B')).toBeInTheDocument();
  });

  test('renders progress bars for volume visualization', () => {
    render(<StockOrderBookWidget orderBook={mockOrderBook} loading={false} error={null} onRefresh={jest.fn()} />);

    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars.length).toBe(6); // 3 bids + 3 asks
  });

  test('shows timestamp when available', () => {
    render(<StockOrderBookWidget orderBook={mockOrderBook} loading={false} error={null} onRefresh={jest.fn()} />);

    expect(screen.getByText(/cập nhật:/i)).toBeInTheDocument();
  });

  test('accessibility: has proper ARIA roles', () => {
    render(<StockOrderBookWidget orderBook={mockOrderBook} loading={false} error={null} onRefresh={jest.fn()} />);

    // The widget is a div with class ob-widget, check for the rowgroups
    const bidGroup = screen.getByRole('rowgroup', { name: /ba mức giá mua/i });
    expect(bidGroup).toBeInTheDocument();

    const askGroup = screen.getByRole('rowgroup', { name: /ba mức giá bán/i });
    expect(askGroup).toBeInTheDocument();
  });

  test('keyboard navigable rows', () => {
    render(<StockOrderBookWidget orderBook={mockOrderBook} loading={false} error={null} onRefresh={jest.fn()} />);

    const rows = screen.getAllByRole('row');
    rows.forEach((row) => {
      expect(row).toHaveAttribute('tabIndex', '0');
    });
  });

  test('formats large volumes correctly', () => {
    const largeVolumeOrderBook = {
      ...mockOrderBook,
      bids: [{ price: 100000, volume: 1500000000, orders: 10 }],
      asks: [{ price: 100001, volume: 2500000, orders: 10 }],
    };

    render(<StockOrderBookWidget orderBook={largeVolumeOrderBook} loading={false} error={null} onRefresh={jest.fn()} />);

    expect(screen.getByText('1.5T')).toBeInTheDocument(); // 1.5 billion -> 1.5T
    expect(screen.getByText('2.5Tr')).toBeInTheDocument(); // 2.5 million -> 2.5Tr
  });
});