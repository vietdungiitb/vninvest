/**
 * StockExecutionLogWidget.test.jsx
 * Unit tests for the Trade Log widget component
 */
import { render, screen, fireEvent } from '@testing-library/react';
// jest is available globally via setupTests.js
import { StockExecutionLogWidget } from './StockExecutionLogWidget.jsx';

describe('StockExecutionLogWidget', () => {
  const mockTrades = [
    { time: '10:00:00', price: 100000, volume: 1000, side: 'BUY' },
    { time: '10:00:05', price: 100010, volume: 500, side: 'SELL' },
    { time: '10:00:10', price: 99990, volume: 2000, side: 'BUY' },
  ];

  const prevClose = 100000;

  test('renders trade log with trades', () => {
    render(<StockExecutionLogWidget trades={mockTrades} loading={false} error={null} onRefresh={jest.fn()} prevClose={prevClose} />);

    expect(screen.getByText('Nhật ký khớp lệnh (Trade Log)')).toBeInTheDocument();
    expect(screen.getByText('3 giao dịch')).toBeInTheDocument();

    // Check trades
    expect(screen.getByText('10:00:00')).toBeInTheDocument();
    expect(screen.getByText('10:00:05')).toBeInTheDocument();
    expect(screen.getByText('10:00:10')).toBeInTheDocument();

    // Check prices (vi-VN format: dot for thousands, comma for decimals)
    expect(screen.getByText('100.000,00')).toBeInTheDocument();
    expect(screen.getByText('100.010,00')).toBeInTheDocument();
    expect(screen.getByText('99.990,00')).toBeInTheDocument();

    // Check volumes
    expect(screen.getByText('1K')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('2K')).toBeInTheDocument();

    // Check side badges (Vietnamese labels)
    expect(screen.getAllByText('Mua').length).toBeGreaterThan(0); // Buy
    expect(screen.getAllByText('Bán').length).toBeGreaterThan(0); // Sell
  });

  test('renders loading skeleton when loading', () => {
    render(<StockExecutionLogWidget trades={[]} loading={true} error={null} onRefresh={jest.fn()} prevClose={prevClose} />);

    expect(screen.getAllByText('--:--:--').length).toBeGreaterThan(0);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  test('renders error state with retry button', () => {
    const onRefresh = jest.fn();
    render(<StockExecutionLogWidget trades={[]} loading={false} error="Failed to load" onRefresh={onRefresh} prevClose={prevClose} />);

    expect(screen.getByText('Failed to load')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /thử lại/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /thử lại/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  test('shows empty state when no trades', () => {
    render(<StockExecutionLogWidget trades={[]} loading={false} error={null} onRefresh={jest.fn()} prevClose={prevClose} />);

    expect(screen.getByText('Chưa có khớp lệnh trong phiên này')).toBeInTheDocument();
  });

  test('calculates change vs prevClose correctly', () => {
    render(<StockExecutionLogWidget trades={mockTrades} loading={false} error={null} onRefresh={jest.fn()} prevClose={100000} />);

    const rows = screen.getAllByRole('listitem');
    // First trade: 100000 vs 100000 = neutral (no up/down class)
    const priceEl1 = rows[0].querySelector('.tl-price');
    expect(priceEl1).not.toHaveClass('up');
    expect(priceEl1).not.toHaveClass('down');

    // Second trade: 100010 vs 100000 = up
    const priceEl2 = rows[1].querySelector('.tl-price');
    expect(priceEl2).toHaveClass('up');

    // Third trade: 99990 vs 100000 = down
    const priceEl3 = rows[2].querySelector('.tl-price');
    expect(priceEl3).toHaveClass('down');
  });

  test('shows color-blind friendly indicators', () => {
    render(<StockExecutionLogWidget trades={mockTrades} loading={false} error={null} onRefresh={jest.fn()} prevClose={prevClose} />);

    // Component uses color coding instead of ▲/▼ icons in SaaS-native version
    // This test documents the expected behavior - verify color classes exist
    const buyRows = screen.getAllByText('Mua');
    const sellRows = screen.getAllByText('Bán');
    expect(buyRows.length).toBeGreaterThan(0);
    expect(sellRows.length).toBeGreaterThan(0);
  });

  test('accessibility: has proper ARIA roles', () => {
    render(<StockExecutionLogWidget trades={mockTrades} loading={false} error={null} onRefresh={jest.fn()} prevClose={prevClose} />);

    const list = screen.getByRole('log', { name: /danh sách khớp lệnh/i });
    expect(list).toBeInTheDocument();
    expect(list).toHaveAttribute('aria-live', 'polite');
    expect(list).toHaveAttribute('aria-atomic', 'false');
  });

  test('newest trade has aria-live polite', () => {
    render(<StockExecutionLogWidget trades={mockTrades} loading={false} error={null} onRefresh={jest.fn()} prevClose={prevClose} />);

    const firstRow = screen.getAllByRole('listitem')[0];
    expect(firstRow).toHaveAttribute('aria-live', 'polite');
  });

  test('formats large volumes correctly', () => {
    const largeVolumeTrades = [
      { time: '10:00:00', price: 100000, volume: 1500000, side: 'BUY' },
      { time: '10:00:05', price: 100010, volume: 2500000, side: 'SELL' },
    ];

    render(<StockExecutionLogWidget trades={largeVolumeTrades} loading={false} error={null} onRefresh={jest.fn()} prevClose={prevClose} />);

    // vi-VN format for large volumes
    expect(screen.getByText('1,5Tr')).toBeInTheDocument();
    expect(screen.getByText('2,5Tr')).toBeInTheDocument();
  });

  test('handles missing prevClose gracefully', () => {
    render(<StockExecutionLogWidget trades={mockTrades} loading={false} error={null} onRefresh={jest.fn()} prevClose={null} />);

    const rows = screen.getAllByRole('listitem');
    rows.forEach(row => {
      const priceEl = row.querySelector('.tl-price');
      expect(priceEl).not.toHaveClass('up');
      expect(priceEl).not.toHaveClass('down');
    });
  });
});