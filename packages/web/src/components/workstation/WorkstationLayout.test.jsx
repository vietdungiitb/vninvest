/**
 * WorkstationLayout.test.jsx
 * Unit tests for the Workstation layout component
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
// jest is available globally via setupTests.js
import { WorkstationLayout } from './WorkstationLayout.jsx';

// Mock window.matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('WorkstationLayout', () => {
  const mockLeftContent = <div data-testid="left-content">Chart + Radar</div>;
  const mockRightContent = (
    <div data-testid="right-content">
      <div data-testid="orderbook">OrderBookWidget</div>
      <div data-testid="tradelog">TradeLogWidget</div>
    </div>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset window.__ENV__
    delete window.__ENV__;
    localStorage.clear();
  });

  test('renders legacy stack when feature disabled', () => {
    render(
      <WorkstationLayout enabled={false}>
        {{ left: mockLeftContent, right: mockRightContent }}
      </WorkstationLayout>
    );

    expect(screen.getByTestId('left-content')).toBeInTheDocument();
    expect(screen.getByTestId('right-content')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  test('renders desktop split-screen when feature enabled and wide viewport', () => {
    // Set feature flag before render
    window.__ENV__ = { WORKSTATION_LAYOUT_V2: true };
    window.innerWidth = 1024;
    window.dispatchEvent(new Event('resize'));

    render(
      <WorkstationLayout enabled={true}>
        {{ left: mockLeftContent, right: mockRightContent }}
      </WorkstationLayout>
    );

    expect(screen.getByTestId('left-content')).toBeInTheDocument();
    expect(screen.getByTestId('right-content')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByTestId('left-content').parentElement).toHaveClass('ws-left-column');
    expect(screen.getByTestId('right-content').parentElement).toHaveClass('ws-right-column');
  });

  test('renders mobile tab switcher when feature enabled and narrow viewport', () => {
    // Set feature flag before render
    window.__ENV__ = { WORKSTATION_LAYOUT_V2: true };
    window.innerWidth = 375;
    window.dispatchEvent(new Event('resize'));

    render(
      <WorkstationLayout enabled={true}>
        {{ left: mockLeftContent, right: mockRightContent }}
      </WorkstationLayout>
    );

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /biểu đồ/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /sổ lệnh/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /khớp lệnh/i })).toBeInTheDocument();
  });

  test('switches tabs on mobile', () => {
    // Set feature flag before render
    window.__ENV__ = { WORKSTATION_LAYOUT_V2: true };
    window.innerWidth = 375;
    window.dispatchEvent(new Event('resize'));

    render(
      <WorkstationLayout enabled={true}>
        {{ left: mockLeftContent, right: mockRightContent }}
      </WorkstationLayout>
    );

    // Default tab is chart
    expect(screen.getByRole('tab', { name: /biểu đồ/i })).toHaveAttribute('aria-selected', 'true');
    expect(document.getElementById('panel-chart')).not.toHaveAttribute('hidden');

    // Click orderbook tab
    fireEvent.click(screen.getByRole('tab', { name: /sổ lệnh/i }));

    expect(screen.getByRole('tab', { name: /sổ lệnh/i })).toHaveAttribute('aria-selected', 'true');
    expect(document.getElementById('panel-orderbook')).not.toHaveAttribute('hidden');
    expect(document.getElementById('panel-chart')).toHaveAttribute('hidden');

    // Click tradelog tab
    fireEvent.click(screen.getByRole('tab', { name: /khớp lệnh/i }));

    expect(screen.getByRole('tab', { name: /khớp lệnh/i })).toHaveAttribute('aria-selected', 'true');
    expect(document.getElementById('panel-tradelog')).not.toHaveAttribute('hidden');
  });

  test('reads feature flag from window.__ENV__', () => {
    window.__ENV__ = { WORKSTATION_LAYOUT_V2: true };
    window.innerWidth = 1024;
    window.dispatchEvent(new Event('resize'));

    render(
      <WorkstationLayout enabled={false}>
        {{ left: mockLeftContent, right: mockRightContent }}
      </WorkstationLayout>
    );

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByTestId('left-content').parentElement).toHaveClass('ws-left-column');
  });

  test('reads feature flag from localStorage', () => {
    localStorage.setItem('workstation_v2', 'true');
    window.innerWidth = 1024;
    window.dispatchEvent(new Event('resize'));

    render(
      <WorkstationLayout enabled={false}>
        {{ left: mockLeftContent, right: mockRightContent }}
      </WorkstationLayout>
    );

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByTestId('left-content').parentElement).toHaveClass('ws-left-column');
  });

  test('localStorage takes precedence over window.__ENV__ when both set', () => {
    window.__ENV__ = { WORKSTATION_LAYOUT_V2: false };
    localStorage.setItem('workstation_v2', 'true');
    window.innerWidth = 1024;
    window.dispatchEvent(new Event('resize'));

    render(
      <WorkstationLayout enabled={false}>
        {{ left: mockLeftContent, right: mockRightContent }}
      </WorkstationLayout>
    );

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByTestId('left-content').parentElement).toHaveClass('ws-left-column');
  });

  test('accessibility: tab list has proper ARIA attributes', () => {
    window.innerWidth = 375;
    window.dispatchEvent(new Event('resize'));

    render(
      <WorkstationLayout enabled={true}>
        {{ left: mockLeftContent, right: mockRightContent }}
      </WorkstationLayout>
    );

    const tabList = screen.getByRole('tablist');
    expect(tabList).toHaveAttribute('aria-label', 'Chế độ xem Workstation');

    const tabs = screen.getAllByRole('tab');
    tabs.forEach((tab) => {
      expect(tab).toHaveAttribute('aria-selected');
      expect(tab).toHaveAttribute('aria-controls');
      expect(tab).toHaveAttribute('id');
    });

    const panels = screen.getAllByRole('tabpanel', { hidden: true });
    panels.forEach((panel) => {
      expect(panel).toHaveAttribute('aria-labelledby');
      expect(panel).toHaveAttribute('id');
    });
  });

  test('cleanup on unmount removes resize listener', () => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

    const { unmount } = render(
      <WorkstationLayout enabled={true}>
        {{ left: mockLeftContent, right: mockRightContent }}
      </WorkstationLayout>
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});