/**
 * StockOrderBookWidget.test.jsx
 * Unit tests for the Order Book widget component
 */
import { render, screen, fireEvent } from '@testing-library/react';
// jest is available globally via setupTests.js
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

    expect(screen.getByText('Độ sâu thị trường (Market Depth)')).toBeInTheDocument();
    expect(screen.getByText('Spread:')).toBeInTheDocument();
    expect(screen.getByText('0.05')).toBeInTheDocument();

    // Check bids
    expect(screen.getByText('99.999,95')).toBeInTheDocument();
    expect(screen.getByText('99.999,90')).toBeInTheDocument();
    expect(screen.getByText('99.999,85')).toBeInTheDocument();

    // Check asks
    expect(screen.getByText('100.000,00')).toBeInTheDocument();
    expect(screen.getByText('100.000,05')).toBeInTheDocument();
    expect(screen.getByText('100.000,10')).toBeInTheDocument();

    // Check volumes
    expect(screen.getAllByText('6K').length).toBeGreaterThan(0);
    expect(screen.getAllByText('4.5K').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3K').length).toBeGreaterThan(0);

  });

  test('renders loading skeleton when loading', () => {
    render(<StockOrderBookWidget orderBook={null} loading={true} error={null} onRefresh={jest.fn()} />);

    // Should show skeleton rows
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
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

    // Mua (Bid) and Bán (Ask) are visible as column headers
    expect(screen.getByText('Mua', { selector: '.ob-side-title.bids' })).toBeInTheDocument();
    expect(screen.getByText('Bán', { selector: '.ob-side-title.asks' })).toBeInTheDocument();
  });

  test('renders progress bars for volume visualization', () => {
    render(<StockOrderBookWidget orderBook={mockOrderBook} loading={false} error={null} onRefresh={jest.fn()} />);

    const progressBars = screen.getAllByRole('progressbar', { hidden: true });
    expect(progressBars.length).toBe(6); // 3 bids + 3 asks
  });

  test('shows timestamp when available', () => {
    render(<StockOrderBookWidget orderBook={mockOrderBook} loading={false} error={null} onRefresh={jest.fn()} />);

    expect(screen.getByText(/cập nhật:/i)).toBeInTheDocument();
  });

  test('accessibility: has proper ARIA roles', () => {
    render(<StockOrderBookWidget orderBook={mockOrderBook} loading={false} error={null} onRefresh={jest.fn()} />);

    // The widget uses aria-label "Giá Mua (Bid)" and "Giá Bán (Ask)" for rowgroups
    const bidGroup = screen.getByRole('rowgroup', { name: /Giá Mua \(Bid\)/i });
    expect(bidGroup).toBeInTheDocument();

    const askGroup = screen.getByRole('rowgroup', { name: /Giá Bán \(Ask\)/i });
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

    expect(screen.getByText('1,5T')).toBeInTheDocument(); // 1.5 billion -> 1,5T
    expect(screen.getByText('2,5Tr')).toBeInTheDocument(); // 2.5 million -> 2,5Tr
  });
});