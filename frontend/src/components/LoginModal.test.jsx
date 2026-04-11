import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import LoginModal from './LoginModal';
import { usePortfolio } from '../context/PortfolioContext';
import { useI18n } from '../context/LangContext';
import * as client from '../api/client';

// Mock dependencies
jest.mock('../context/PortfolioContext');
jest.mock('../context/LangContext');
jest.mock('../api/client');

const mockT = (key) => key;
const mockPortfolioContext = {
  login: jest.fn(),
  register: jest.fn(),
  resendVerification: jest.fn(),
};
const mockI18nContext = {
  t: mockT,
  locale: 'vi',
  setLanguage: jest.fn(),
};

describe('LoginModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePortfolio.mockReturnValue(mockPortfolioContext);
    useI18n.mockReturnValue(mockI18nContext);
    // Keep legal pages request unresolved in tests to avoid unrelated async state updates.
    client.fetchLegalPages.mockRejectedValue(new Error('skip legal pages in LoginModal tests'));
  });

  it('renders login form on mount', () => {
    render(<LoginModal onSuccess={jest.fn()} />);
    expect(screen.getByPlaceholderText('auth.usernamePlaceholder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });

  describe('Login error handling', () => {
    it('shows invalid credentials error for 401 response', async () => {
      mockPortfolioContext.login.mockRejectedValue({
        response: {
          status: 401,
          data: { detail: 'Invalid credentials' },
        },
      });

      render(<LoginModal onSuccess={jest.fn()} />);
      
      const usernameInput = screen.getByPlaceholderText('auth.usernamePlaceholder');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      
      await userEvent.type(usernameInput, 'testuser');
      await userEvent.type(passwordInput, 'password123');
      
      const submitButton = screen.getByText('auth.login', { selector: 'button[type="submit"]' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('auth.loginErrorInvalidCredentials')).toBeInTheDocument();
      });
    });

    it('shows unverified email error for email verification message', async () => {
      mockPortfolioContext.login.mockRejectedValue({
        response: {
          status: 400,
          data: { detail: 'chưa xác thực email' },
        },
      });

      render(<LoginModal onSuccess={jest.fn()} />);
      
      const usernameInput = screen.getByPlaceholderText('auth.usernamePlaceholder');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      
      await userEvent.type(usernameInput, 'testuser');
      await userEvent.type(passwordInput, 'password123');
      
      const submitButton = screen.getByText('auth.login', { selector: 'button[type="submit"]' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('auth.loginErrorUnverifiedEmail')).toBeInTheDocument();
      });
    });

    it('shows network error for no response', async () => {
      mockPortfolioContext.login.mockRejectedValue({
        response: undefined,
      });

      render(<LoginModal onSuccess={jest.fn()} />);
      
      const usernameInput = screen.getByPlaceholderText('auth.usernamePlaceholder');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      
      await userEvent.type(usernameInput, 'testuser');
      await userEvent.type(passwordInput, 'password123');
      
      const submitButton = screen.getByText('auth.login', { selector: 'button[type="submit"]' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('auth.loginErrorNetwork')).toBeInTheDocument();
      });
    });

    it('shows rate limit error for 429 status', async () => {
      mockPortfolioContext.login.mockRejectedValue({
        response: {
          status: 429,
          data: { detail: 'Too many requests' },
        },
      });

      render(<LoginModal onSuccess={jest.fn()} />);
      
      const usernameInput = screen.getByPlaceholderText('auth.usernamePlaceholder');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      
      await userEvent.type(usernameInput, 'testuser');
      await userEvent.type(passwordInput, 'password123');
      
      const submitButton = screen.getByText('auth.login', { selector: 'button[type="submit"]' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('auth.loginErrorRateLimited')).toBeInTheDocument();
      });
    });

    it('shows server error for 500+ status', async () => {
      mockPortfolioContext.login.mockRejectedValue({
        response: {
          status: 500,
          data: { detail: 'Internal server error' },
        },
      });

      render(<LoginModal onSuccess={jest.fn()} />);
      
      const usernameInput = screen.getByPlaceholderText('auth.usernamePlaceholder');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      
      await userEvent.type(usernameInput, 'testuser');
      await userEvent.type(passwordInput, 'password123');
      
      const submitButton = screen.getByText('auth.login', { selector: 'button[type="submit"]' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('auth.loginErrorServer')).toBeInTheDocument();
      });
    });
  });

  describe('Resend verification action', () => {
    it('shows resend verification button when unverified email error occurs', async () => {
      mockPortfolioContext.login.mockRejectedValue({
        response: {
          status: 400,
          data: { detail: 'chưa xác thực email' },
        },
      });

      render(<LoginModal onSuccess={jest.fn()} />);
      
      const usernameInput = screen.getByPlaceholderText('auth.usernamePlaceholder');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      
      await userEvent.type(usernameInput, 'testuser');
      await userEvent.type(passwordInput, 'password123');
      
      const submitButton = screen.getByText('auth.login', { selector: 'button[type="submit"]' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /auth.resendVerification/i })).toBeInTheDocument();
      });
    });

    it('does not show resend verification button for invalid credentials', async () => {
      mockPortfolioContext.login.mockRejectedValue({
        response: {
          status: 401,
          data: { detail: 'Invalid credentials' },
        },
      });

      render(<LoginModal onSuccess={jest.fn()} />);

      const usernameInput = screen.getByPlaceholderText('auth.usernamePlaceholder');
      const passwordInput = screen.getByPlaceholderText('••••••••');

      await userEvent.type(usernameInput, 'testuser');
      await userEvent.type(passwordInput, 'password123');

      const submitButton = screen.getByText('auth.login', { selector: 'button[type="submit"]' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('auth.loginErrorInvalidCredentials')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /auth.resendVerification/i })).not.toBeInTheDocument();
    });

    it('shows resend verification button for english unverified error', async () => {
      mockPortfolioContext.login.mockRejectedValue({
        response: {
          status: 401,
          data: { detail: 'Email not verified yet.' },
        },
      });

      render(<LoginModal onSuccess={jest.fn()} />);

      const usernameInput = screen.getByPlaceholderText('auth.usernamePlaceholder');
      const passwordInput = screen.getByPlaceholderText('••••••••');

      await userEvent.type(usernameInput, 'testuser');
      await userEvent.type(passwordInput, 'password123');

      const submitButton = screen.getByText('auth.login', { selector: 'button[type="submit"]' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('auth.loginErrorUnverifiedEmail')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /auth.resendVerification/i })).toBeInTheDocument();
    });

    it('calls resendVerification when resend button clicked', async () => {
      mockPortfolioContext.login.mockRejectedValue({
        response: {
          status: 400,
          data: { detail: 'chưa xác thực email' },
        },
      });
      mockPortfolioContext.resendVerification.mockResolvedValue({
        message: 'Verification email sent',
      });

      render(<LoginModal onSuccess={jest.fn()} />);
      
      const usernameInput = screen.getByPlaceholderText('auth.usernamePlaceholder');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      
      await userEvent.type(usernameInput, 'testuser');
      await userEvent.type(passwordInput, 'password123');
      
      const submitButton = screen.getByText('auth.login', { selector: 'button[type="submit"]' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const resendButton = screen.getByRole('button', { name: /auth.resendVerification/i });
        fireEvent.click(resendButton);
      });

      await waitFor(() => {
        expect(mockPortfolioContext.resendVerification).toHaveBeenCalledWith('testuser');
      });
    });
  });

  it('successfully logs in with valid credentials', async () => {
    mockPortfolioContext.login.mockResolvedValue({
      access: 'token',
    });

    const onSuccess = jest.fn();
    render(<LoginModal onSuccess={onSuccess} />);
    
    const usernameInput = screen.getByPlaceholderText('auth.usernamePlaceholder');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    
    await userEvent.type(usernameInput, 'validuser');
    await userEvent.type(passwordInput, 'validpass123');
    
    const submitButton = screen.getByText('auth.login', { selector: 'button[type="submit"]' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockPortfolioContext.login).toHaveBeenCalledWith('validuser', 'validpass123');
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('switches between login and register modes', async () => {
    render(<LoginModal onSuccess={jest.fn()} />);
    
    const registerButton = screen.getByRole('button', { name: 'auth.register' });
    fireEvent.click(registerButton);

    // Should show email field in register mode
    await waitFor(() => {
      expect(screen.getByPlaceholderText('auth.emailPlaceholder')).toBeInTheDocument();
    });
  });
});



