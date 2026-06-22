import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';

interface UserIdentity {
  id: string | null;
  username: string;
  email: string;
  isStaff: boolean;
  isSuperuser: boolean;
  avatar_url?: string;
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

interface PortfolioContextValue {
  portfolios: Portfolio[];
  activePortfolioId: string | null;
  setActivePortfolioId: (id: string | null) => void;
  isAuthenticated: boolean;
  authStateReady: boolean;
  login: (username: string, password: string) => Promise<any>;
  register: (data: { username: string; email: string; password: string; passwordConfirm: string }) => Promise<any>;
  resendVerification: (identifier: string) => Promise<any>;
  logout: () => void;
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