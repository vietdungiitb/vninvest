import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { coreApiAdapter } from '../../../adapters/coreApiAdapter.js';
import TrademarkConfigPanel from '../components/TrademarkConfigPanel.jsx';

describe('TrademarkConfigPanel', () => {
  let getSpy;
  let patchSpy;

  beforeEach(() => {
    getSpy = jest
      .spyOn(coreApiAdapter, 'getTrademarkConfig')
      .mockResolvedValue({ trademark: { enabled: false, activationTs: null, version: 'cfg_v1' } });
    patchSpy = jest.spyOn(coreApiAdapter, 'updateTrademarkConfig').mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function renderPanel() {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return render(
      <QueryClientProvider client={qc}>
        <TrademarkConfigPanel />
      </QueryClientProvider>
    );
  }

  it('renders the trademark config form', async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText('advertising.trademark.title')).toBeInTheDocument());
    expect(screen.getByText('advertising.trademark.save')).toBeInTheDocument();
  });

  it('disables the activation picker until the toggle is enabled', async () => {
    const { container } = renderPanel();
    await screen.findByText('advertising.trademark.save');

    const input = container.querySelector('input[type="datetime-local"]');
    expect(input).toBeDisabled();

    const [toggle] = screen.getAllByRole('button');
    fireEvent.click(toggle);
    expect(input).not.toBeDisabled();
  });

  it('saves enabled state and activation timestamp', async () => {
    const { container } = renderPanel();
    await screen.findByText('advertising.trademark.save');

    const input = container.querySelector('input[type="datetime-local"]');
    const [toggle, save] = screen.getAllByRole('button');
    fireEvent.click(toggle);
    fireEvent.change(input, { target: { value: '2030-01-15T09:30' } });
    fireEvent.click(save);

    await waitFor(() => expect(patchSpy).toHaveBeenCalledTimes(1));
    const payload = patchSpy.mock.calls[0][0];
    expect(payload.enabled).toBe(true);
    expect(payload.activation_ts).toBe(new Date('2030-01-15T09:30').getTime());
    expect(payload.version).toMatch(/^cfg_v\d+$/);
  });
});
