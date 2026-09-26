import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';

interface UserIdentity {
  id: string | null;
  username: string;
  email: string;
  isStaff: boolean;
  isSuperuser: boolean;
  avatar_url?: string;
  display_name?: string;
}

interface UserConfig {
  language: string;
  theme: string;
  whale_alert_threshold: string;
}

interface Portfolio {
  id: string;
  name: string;
  // Add other portfolio fields as needed
}

interface Tenant {
  tenant_id: string;
  public_id: string;
  id: string;
  display_name: string;
  plan: string;
}

interface Ability {
  can: (action: string, subject: any) => boolean;
  cannot: (action: string, subject: any) => boolean;
}

interface AuthStateError {
  message: string;
  /** false = retrying cannot help (e.g. a persistent 403), so no retry button. */
  retryable?: boolean;
  i18nKey?: string;
  defaultMessage?: string;
}

interface PortfolioContextValue {
  portfolios: Portfolio[];
  activePortfolioId: string | null;
  setActivePortfolioId: (id: string | null) => void;
  isAuthenticated: boolean;
  authStateReady: boolean;
  /**
   * Set when the session is still valid but the identity bootstrap failed. The
   * shell renders this instead of an empty, errorless app. `null` when healthy.
   */
  authStateError: AuthStateError | null;
  retryAuthBootstrap: () => void;
  login: (username: string, password: string) => Promise<any>;
  resendVerification: (identifier: string) => Promise<any>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  userConfig: UserConfig | null;
  updateUserConfig: (data: Partial<UserConfig>) => Promise<any>;
  loading: boolean;
  fetchPortfolios: () => Promise<void>;
  userPlan: string;
  userIdentity: UserIdentity;
  userEntitlements: any;
  capabilitySnapshot: any;
  ability: Ability;
  createPortfolio: (data: any) => Promise<any>;
  updatePortfolio: (id: string, data: any) => Promise<any>;
  deletePortfolio: (id: string) => Promise<void>;
  createSubAccount: (data: any) => Promise<any>;
  updateSubAccount: (id: string, data: any) => Promise<any>;
  deleteSubAccount: (id: string) => Promise<void>;
  userTenants: Tenant[];
  switchTenant: (tenantId: string) => void;
  activeTenantId: string | null;
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: { children: ReactNode }): JSX.Element;

export function usePortfolio(): PortfolioContextValue;