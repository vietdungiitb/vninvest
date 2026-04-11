import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import ResetPassword from './ResetPassword';
import { confirmPasswordReset, requestPasswordReset } from '../api/auth';
import { useI18n } from '../context/LangContext';

jest.mock('../api/auth');
jest.mock('../context/LangContext');

const mockI18n = {
  t: (key) => key,
  locale: 'vi',
  setLanguage: jest.fn(),
};

function renderWithRoute(path = '/reset-password') {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ResetPassword />
    </MemoryRouter>,
  );
}

describe('ResetPassword page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useI18n.mockReturnValue(mockI18n);
  });

  it('renders request mode by default and sends reset request', async () => {
    requestPasswordReset.mockResolvedValue({
      data: { message: 'request-ok' },
    });

    renderWithRoute('/reset-password');

    expect(screen.getByText('resetPassword.requestTitle')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('resetPassword.identifierPlaceholder'), {
      target: { value: 'alice@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'resetPassword.requestSubmit' }));

    await waitFor(() => {
      expect(requestPasswordReset).toHaveBeenCalledWith('alice@example.com');
    });

    await waitFor(() => {
      expect(screen.getByText('request-ok')).toBeInTheDocument();
    });
  });

  it('renders confirm mode when token exists and confirms password reset', async () => {
    confirmPasswordReset.mockResolvedValue({
      data: { message: 'confirm-ok' },
    });

    renderWithRoute('/reset-password?token=test-token-123');

    expect(screen.getByText('resetPassword.confirmTitle')).toBeInTheDocument();

    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passwordInputs[0], { target: { value: 'NewPass@123456' } });
    fireEvent.change(passwordInputs[1], { target: { value: 'NewPass@123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'resetPassword.confirmSubmit' }));

    await waitFor(() => {
      expect(confirmPasswordReset).toHaveBeenCalledWith('test-token-123', 'NewPass@123456', 'NewPass@123456');
    });

    await waitFor(() => {
      expect(screen.getByText('confirm-ok')).toBeInTheDocument();
    });
  });

  it('shows fallback error message on request failure', async () => {
    requestPasswordReset.mockRejectedValue({ response: { data: {} } });

    renderWithRoute('/reset-password');

    fireEvent.change(screen.getByPlaceholderText('resetPassword.identifierPlaceholder'), {
      target: { value: 'bob' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'resetPassword.requestSubmit' }));

    await waitFor(() => {
      expect(screen.getByText('resetPassword.requestError')).toBeInTheDocument();
    });
  });
});
