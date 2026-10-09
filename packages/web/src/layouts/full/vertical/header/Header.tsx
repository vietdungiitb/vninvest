import { createElement, Fragment, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePortfolio } from '@/context/PortfolioContext.js';
import { useI18n } from '@/context/LangContext.js';
import { cn } from '@/lib/utils';
import { Search, Bell, LogOut, User, Settings } from 'lucide-react';
import { isNewLayoutEnabled } from '@/lib/runtimeConfig';
import { useCoreQuery } from '@/hooks/useCoreQuery.ts';
import { useUrlValue, stringCodec } from '@/hooks/useUrlState';
import { coreApiAdapter } from '@/adapters/coreApiAdapter.js';

interface UserIdentity {
  id: string | null;
  username: string;
  email: string;
  isStaff: boolean;
  isSuperuser: boolean;
  avatar_url?: string;
  display_name?: string;
}

const e = createElement;

interface HeaderProps {
  onMenuClick: () => void;
  sidebarCollapsed?: boolean;
  mobileSidebarOpen?: boolean;
}

export function Header({ onMenuClick, sidebarCollapsed = false, mobileSidebarOpen }: HeaderProps) {
  const { userIdentity = {} as UserIdentity, logout, isAuthenticated } = usePortfolio();
  const [toasts, setToasts] = useState<Array<{ id: string; title?: string; symbol?: string }>>([]);
  const summaryQ = useCoreQuery(['alert-center-summary-global'], {
    enabled: !!isAuthenticated,
    refetchInterval: isAuthenticated ? 30000 : false,
    queryFn: () => coreApiAdapter.getAlertCenterSummary({ timeframe: 'session' }) as Promise<unknown>,
  });
  const unseenCount = Number((summaryQ.data as any)?.unseen || 0);

  useEffect(() => {
    function onNewAlert(ev: Event) {
      const detail = (ev as CustomEvent)?.detail as any;
      const id = String(detail?.alert_id ?? detail?.event_id ?? Date.now());
      setToasts((prev) => [...prev.slice(-2), { id, title: detail?.title, symbol: detail?.symbol }]);
      try {
        const audio = new Audio('/sounds/alert.mp3');
        const played = audio.play();
        if (played && typeof (played as Promise<void>).catch === 'function') {
          (played as Promise<void>).catch(() => {});
        }
      } catch {
        // no sound asset — silent
      }
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((n) => n.id !== id));
      }, 5000);
    }
    window.addEventListener('alert-center-new', onNewAlert as EventListener);
    return () => window.removeEventListener('alert-center-new', onNewAlert as EventListener);
  }, []);

  const dismissToast = (id: string) => setToasts((prev) => prev.filter((n) => n.id !== id));
  const { t, locale, setLanguage } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const newLayout = isNewLayoutEnabled();

  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  // WAVE 6 / NAV-1 — o tim ma o header chua dong bo URL: F5 mat noi dung dung.
  // Mac dinh giong het `useState` cu (`''`) va KHONG ghi ra URL.
  // `replace: true` — o input gắn thẳng `onChange`; neu push, moi KY TU tao
  // 1 history entry ⇒ nguoi dung phai bam Back hang chuc lan (loi that wave 4).
  const [searchVal, setSearchVal] = useUrlValue('q', stringCodec, '', { replace: true });

  useEffect(() => {
    setWsStatus('connected');
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchVal.trim()) {
      navigate(`/stocks/${searchVal.trim().toUpperCase()}`);
      setSearchVal('');
    }
  };

  /**
   * E2 (P0) — `logout()` now revokes the PAT (POST /auth/logout/) before
   * clearing local state and never rejects, so it is safe to fire without
   * awaiting. Navigate first: the revoke is bounded at 5s internally and the
   * user should not stare at the app while it runs.
   */
  const handleLogout = () => {
    navigate('/login');
    void logout();
  };

  // E5 (P1): display_name and avatar_url are only returned by
  // GET /identity/profile/; PortfolioContext now surfaces them. The cast is
  // needed because context/PortfolioContext.d.ts's UserIdentity does not declare
  // display_name yet (that file is outside this slice) — listed for the
  // coordinator.
  const displayName = (userIdentity as UserIdentity).display_name || userIdentity.username || '';

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const toastLayer = toasts.length > 0 && e(
    'div',
    { style: { position: 'fixed', right: 16, bottom: 16, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 8 } },
    ...toasts.map((n) => e(
      'div',
      {
        key: n.id,
        role: 'status',
        onClick: () => { dismissToast(n.id); navigate('/alert-center'); },
        style: { cursor: 'pointer', minWidth: 260, maxWidth: 340, background: 'rgba(2,11,35,0.95)', border: '1px solid rgba(80,120,168,0.25)', borderRadius: 10, padding: '10px 12px' },
      },
      e('div', { style: { fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' } }, t('alertCenter.newAlert')),
      e('div', { style: { fontSize: 12, color: 'var(--text-secondary)' } }, `${n.symbol || ''} ${n.title || ''}`.trim()),
    ))
  );

  return e(
    Fragment,
    null,
    e(
    'header',
    {
      className: cn(
        'sticky top-0 z-30 h-18 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6',
        (!newLayout && sidebarCollapsed) && 'lg:pl-16'
      ),
      role: 'banner'
    },
    // Left: Hamburger (mobile only) + Breadcrumbs
    e(
      'div',
      { className: 'flex items-center gap-4' },
      e(
        Button,
        {
          variant: 'ghost',
          size: 'icon',
          className: cn(newLayout ? 'flex' : 'lg:hidden', 'menu-toggle-btn'),
          onClick: onMenuClick,
          'aria-label': mobileSidebarOpen ? t('layout.collapseMenu') : t('layout.expandMenu'),
          'aria-expanded': mobileSidebarOpen
        },
        e('span', { className: 'h-5 w-5' }, '☰')
      ),
      !newLayout && e(
        Button,
        {
          variant: 'ghost',
          size: 'icon',
          className: 'hidden lg:flex',
          onClick: onMenuClick,
          'aria-label': sidebarCollapsed ? t('layout.expandMenu') : t('layout.collapseMenu'),
          'aria-expanded': !sidebarCollapsed
        },
        e('span', { className: 'h-5 w-5' }, sidebarCollapsed ? '☰' : '✕')
      ),
      e(
        'nav',
        { className: 'hidden md:flex items-center gap-2 text-sm text-slate-400', 'aria-label': 'Breadcrumb' },
        e(
          'button',
          {
            type: 'button',
            onClick: () => navigate('/dashboard'),
            className: 'hover:text-slate-200 transition-colors cursor-pointer bg-transparent border-0 p-0 font-inherit',
            'aria-label': t('layout.home', { defaultValue: 'Về trang tổng quan' })
          },
          'VNInvest'
        ),
        e('span', { className: 'mx-1' }, '/'),
        e('span', { className: 'text-slate-200 font-medium' }, location.pathname.split('/').pop() || 'Dashboard')
      )
    ),
    // Center: Search Input
    e(
      'div',
      { className: 'flex-1 max-w-md mx-8 hidden md:block relative' },
      e(Search, { className: 'absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500' }),
      e(
        Input,
        {
          type: 'text',
          placeholder: t('layout.searchPlaceholder', { defaultValue: 'Tìm mã cổ phiếu...' }),
          className: 'w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-800 text-slate-200 text-sm rounded-lg focus:border-cyan-400 focus:outline-none placeholder:text-slate-500',
          'aria-label': t('layout.searchPlaceholder', { defaultValue: 'Search symbol' }),
          value: searchVal,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSearchVal(e.target.value),
          onKeyDown: handleSearchKeyDown
        }
      )
    ),
    // Right: Status indicators
    e(
      'div',
      { className: 'flex items-center gap-4' },
      // WebSocket Status
      e(
        'div',
        { className: 'flex items-center gap-2 text-xs text-slate-400' },
        e('span', {
          className: `w-2 h-2 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-400 live-dot-pulse' : 'bg-rose-400'}`,
          'aria-hidden': 'true'
        }),
        e('span', { className: 'hidden sm:inline' }, wsStatus === 'connected' ? 'Online' : 'Offline')
      ),
      // Language Selector
      e(
        'select',
        {
          value: locale,
          onChange: handleLanguageChange,
          className: 'bg-slate-800 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:border-cyan-400 focus:outline-none cursor-pointer',
          'aria-label': t('common.language', { defaultValue: 'Language' })
        },
        e('option', { value: 'vi' }, '🇻🇳 VI'),
        e('option', { value: 'en' }, '🇺🇸 EN')
      ),
      // Notifications
      e(
        DropdownMenu,
        null,
        e(
          DropdownMenuTrigger,
          { asChild: true },
          e(
            Button,
            {
              variant: 'ghost',
              size: 'icon',
              className: 'relative',
              'aria-label': t('layout.notifications', { defaultValue: 'Notifications' }),
              onClick: () => navigate('/alert-center')
            },
            e(Bell, { className: 'h-5 w-5' }),
            unseenCount > 0 && e(
              'span',
              { className: 'absolute -top-1 -right-1 min-w-4 h-4 px-0.5 bg-rose-500 text-[10px] font-bold rounded-full flex items-center justify-center' },
              unseenCount > 99 ? '99+' : String(unseenCount)
            )
          )
        ),
        e(
          DropdownMenuContent,
          { align: 'end', className: 'w-80' },
          e(DropdownMenuLabel, null, t('layout.notifications', { defaultValue: 'Notifications' })),
          e(DropdownMenuSeparator, null),
          e(DropdownMenuItem, { className: 'py-2 text-slate-400 text-center' }, 'No new notifications'),
          e(DropdownMenuSeparator, null),
          e(DropdownMenuItem, { asChild: true, className: 'text-center' },
            e(Button, { variant: 'link', className: 'w-full justify-center', onClick: () => navigate('/alert-center') }, t('alertCenter.viewAlert'))
          )
        )
      ),
      // User Profile Dropdown
      e(
        DropdownMenu,
        null,
        e(
          DropdownMenuTrigger,
          { asChild: true },
          e(
            Button,
            { variant: 'ghost', size: 'icon', className: 'relative h-9 w-9 rounded-full' },
            e(
              Avatar,
              { className: 'h-9 w-9' },
              e(AvatarImage, { src: userIdentity.avatar_url, alt: displayName || 'User' }),
              e(AvatarFallback, { className: 'bg-cyan-500/20 text-cyan-400 font-bold' }, getInitials(displayName || 'U'))
            )
          )
        ),
        e(
          DropdownMenuContent,
          { align: 'end', className: 'w-56' },
          e(
            'div',
            { className: 'flex items-center gap-2 p-2' },
            e(
              Avatar,
              { className: 'h-10 w-10' },
              e(AvatarImage, { src: userIdentity.avatar_url, alt: displayName || 'User' }),
              e(AvatarFallback, { className: 'bg-cyan-500/20 text-cyan-400 font-bold' }, getInitials(displayName || 'U'))
            ),
            e(
              'div',
              { className: 'flex-1 min-w-0' },
              e('p', { className: 'text-sm font-medium text-slate-100 truncate' }, displayName || 'User'),
              e('p', { className: 'text-xs text-slate-500 truncate' }, userIdentity.email || '')
            )
          ),
          e(DropdownMenuSeparator, null),
          e(DropdownMenuLabel, null, t('layout.account', { defaultValue: 'Account' })),
          e(
            DropdownMenuItem,
            { asChild: true },
            e(Button, { variant: 'ghost', className: 'w-full justify-start gap-2', onClick: () => navigate('/settings') }, e(User, { className: 'h-4 w-4' }), t('layout.profile', { defaultValue: 'Profile' }))
          ),
          e(
            DropdownMenuItem,
            { asChild: true },
            e(Button, { variant: 'ghost', className: 'w-full justify-start gap-2', onClick: () => navigate('/settings') }, e(Settings, { className: 'h-4 w-4' }), t('layout.settings', { defaultValue: 'Settings' }))
          ),
          e(DropdownMenuSeparator, null),
          e(
            DropdownMenuItem,
            { onClick: handleLogout, className: 'text-rose-400 focus:text-rose-300' },
            e(LogOut, { className: 'h-4 w-4 mr-2' }),
            t('layout.logout', { defaultValue: 'Đăng xuất' })
          )
        )
      )
    )),
    toastLayer,
  );
}

export default Header;
