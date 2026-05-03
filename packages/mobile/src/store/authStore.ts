import { AxiosError } from 'axios';
import { create } from 'zustand';
import type { AuthUser, RegisterPayload } from '../types/auth';
import { getMe, login as loginApi, logout as logoutApi, register as registerApi, restoreSession } from '../services/authApi';

type AuthState = {
  user: AuthUser | null;
  isLoading: boolean;
  errorMessage: string;
  infoMessage: string;
  bootstrap: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  register: (payload: RegisterPayload) => Promise<boolean>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  clearMessages: () => void;
};

const readApiError = (error: unknown): string => {
  const fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.';
  if (!(error instanceof AxiosError)) {
    return fallback;
  }
  const data = error.response?.data as Record<string, unknown> | undefined;
  if (!data) {
    return fallback;
  }
  if (typeof data.detail === 'string') {
    return data.detail;
  }
  if (typeof data.message === 'string') {
    return data.message;
  }
  const firstKey = Object.keys(data)[0];
  if (!firstKey) {
    return fallback;
  }
  const firstValue = data[firstKey];
  if (Array.isArray(firstValue) && typeof firstValue[0] === 'string') {
    return firstValue[0];
  }
  if (typeof firstValue === 'string') {
    return firstValue;
  }
  return fallback;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  errorMessage: '',
  infoMessage: '',

  bootstrap: async () => {
    set({ isLoading: true, errorMessage: '' });
    const user = await restoreSession();
    set({ user, isLoading: false });
  },

  login: async (username, password) => {
    set({ isLoading: true, errorMessage: '', infoMessage: '' });
    try {
      const user = await loginApi(username, password);
      set({ user, isLoading: false });
      return true;
    } catch (error) {
      set({
        user: null,
        isLoading: false,
        errorMessage: readApiError(error),
      });
      return false;
    }
  },

  register: async (payload) => {
    set({ isLoading: true, errorMessage: '', infoMessage: '' });
    try {
      const result = await registerApi(payload);
      set({
        isLoading: false,
        infoMessage: result.message || 'Đăng ký thành công. Vui lòng đăng nhập.',
      });
      return true;
    } catch (error) {
      set({
        isLoading: false,
        errorMessage: readApiError(error),
      });
      return false;
    }
  },

  refreshUser: async () => {
    try {
      const user = await getMe();
      set({ user });
    } catch {
      set({ user: null });
    }
  },

  logout: async () => {
    await logoutApi();
    set({ user: null, errorMessage: '', infoMessage: '' });
  },

  clearMessages: () => set({ errorMessage: '', infoMessage: '' }),
}));
