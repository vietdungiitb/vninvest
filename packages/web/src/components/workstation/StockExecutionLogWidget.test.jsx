/**
 * StockExecutionLogWidget.test.jsx
 * Unit tests for the Trade Log widget component
 */
import { jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
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

    // Check prices
    expect(screen.getByText('100,000.00')).toBeInTheDocument();
    expect(screen.getByText('100,010.00')).toBeInTheDocument();
    expect(screen.getByText('99,990.00')).toBeInTheDocument();

    // Check volumes
    expect(screen.getByText('1K')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('2K')).toBeInTheDocument();

    // Check side badges
    expect(screen.getByText('M')).toBeInTheDocument(); // Buy
    expect(screen.getByText('B')).toBeInTheDocument(); // Sell
  });

  test('renders loading skeleton when loading', () => {
    render(<StockExecutionLogWidget trades={[]} loading={true} error={null} onRefresh={jest.fn()} prevClose={prevClose} />);

    expect(screen.getByText('--:--:--')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
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

    // First trade: 100000 vs 100000 = 0 change
    // Second trade: 100010 vs 100000 = +10 (+0.01%)
    // Third trade: 99990 vs 100000 = -10 (-0.01%)
    expect(screen.getByText('+0.00')).toBeInTheDocument();
    expect(screen.getByText('+0.01%')).toBeInTheDocument();
    expect(screen.getByText('-0.01%')).toBeInTheDocument();
  });

  test('shows color-blind friendly icons', () => {
    render(<StockExecutionLogWidget trades={mockTrades} loading={false} error={null} onRefresh={jest.fn()} prevClose={prevClose} />);

    // Buy icon (▲)
    expect(screen.getByText('▲')).toBeInTheDocument();
    // Sell icon (▼)
    expect(screen.getByText('▼')).toBeInTheDocument();
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

    expect(screen.getByText('1.5Tr')).toBeInTheDocument();
    expect(screen.getByText('2.5Tr')).toBeInTheDocument();
  });

  test('handles missing prevClose gracefully', () => {
    render(<StockExecutionLogWidget trades={mockTrades} loading={false} error={null} onRefresh={jest.fn()} prevClose={null} />);

    expect(screen.getByText('—')).toBeInTheDocument(); // Change shows — when no prevClose
  });
});