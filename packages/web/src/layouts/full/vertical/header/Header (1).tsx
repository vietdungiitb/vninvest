import { createElement, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePortfolio } from '@/context/PortfolioContext.js';
import { useI18n } from '@/context/LangContext.js';
import { cn } from '@/lib/utils';
import { Search, Bell, LogOut, User, Settings } from 'lucide-react';

interface UserIdentity {
  id: string | null;
  username: string;
  email: string;
  isStaff: boolean;
  isSuperuser: boolean;
  avatar_url?: string;
}

const e = createElement;

interface HeaderProps {
  onMenuClick: () => void;
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
}

export function Header({ onMenuClick, sidebarCollapsed, mobileSidebarOpen }: HeaderProps) {
  const { userIdentity = {} as UserIdentity, logout } = usePortfolio();
  const { t, locale, setLanguage } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    setWsStatus('connected');
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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

  return e(
    'header',
    {
      className: cn(
        'sticky top-0 z-30 h-18 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6',
        sidebarCollapsed && 'lg:pl-16'
      ),
      role: 'banner'
    },
    // Left: Hamburger + Breadcrumbs
    e(
      'div',
      { className: 'flex items-center gap-4' },
      e(
        Button,
        {
          variant: 'ghost',
          size: 'icon',
          className: 'lg:hidden',
          onClick: onMenuClick,
          'aria-label': mobileSidebarOpen ? t('layout.collapseMenu') : t('layout.expandMenu'),
          'aria-expanded': mobileSidebarOpen
        },
        e('span', { className: 'h-5 w-5' }, '☰')
      ),
      e(
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
        e('span', null, 'VNInvest'),
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
          placeholder: t('layout.searchPlaceholder') || 'Tìm mã cổ phiếu...',
          className: 'w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-800 text-slate-200 text-sm rounded-lg focus:border-cyan-400 focus:outline-none placeholder:text-slate-500',
          'aria-label': t('layout.searchPlaceholder') || 'Search symbol'
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
          className: cn(
            'w-2 h-2 rounded-full',
            wsStatus === 'connected' ? 'bg-emerald-400 live-dot-pulse' : 'bg-rose-400'
          ),
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
          'aria-label': t('common.language') || 'Language'
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
              'aria-label': t('layout.notifications') || 'Notifications'
            },
            e(Bell, { className: 'h-5 w-5' }),
            e(
              'span',
              { className: 'absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-[10px] font-bold rounded-full flex items-center justify-center' },
              '3'
            )
          )
        ),
        e(
          DropdownMenuContent,
          { align: 'end', className: 'w-80' },
          e(DropdownMenuLabel, null, t('layout.notifications') || 'Notifications'),
          e(DropdownMenuSeparator, null),
          e(DropdownMenuItem, { className: 'py-2 text-slate-400 text-center' }, 'No new notifications'),
          e(DropdownMenuSeparator, null),
          e(DropdownMenuItem, { asChild: true, className: 'text-center' },
            e(Button, { variant: 'link', className: 'w-full justify-center' }, 'View all')
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
              e(AvatarImage, { src: userIdentity.avatar_url, alt: userIdentity.username || 'User' }),
              e(AvatarFallback, { className: 'bg-cyan-500/20 text-cyan-400 font-bold' }, getInitials(userIdentity.username || 'U'))
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
              e(AvatarImage, { src: userIdentity.avatar_url, alt: userIdentity.username || 'User' }),
              e(AvatarFallback, { className: 'bg-cyan-500/20 text-cyan-400 font-bold' }, getInitials(userIdentity.username || 'U'))
            ),
            e(
              'div',
              { className: 'flex-1 min-w-0' },
              e('p', { className: 'text-sm font-medium text-slate-100 truncate' }, userIdentity.username || 'User'),
              e('p', { className: 'text-xs text-slate-500 truncate' }, userIdentity.email || '')
            )
          ),
          e(DropdownMenuSeparator, null),
          e(DropdownMenuLabel, null, t('layout.account') || 'Account'),
          e(
            DropdownMenuItem,
            { asChild: true },
            e(Button, { variant: 'ghost', className: 'w-full justify-start gap-2' }, e(User, { className: 'h-4 w-4' }), t('layout.profile') || 'Profile')
          ),
          e(
            DropdownMenuItem,
            { asChild: true },
            e(Button, { variant: 'ghost', className: 'w-full justify-start gap-2' }, e(Settings, { className: 'h-4 w-4' }), t('layout.settings') || 'Settings')
          ),
          e(DropdownMenuSeparator, null),
          e(
            DropdownMenuItem,
            { onClick: handleLogout, className: 'text-rose-400 focus:text-rose-300' },
            e(LogOut, { className: 'h-4 w-4 mr-2' }),
            t('layout.logout') || 'Đăng xuất'
          )
        )
      )
    )
  );
}

export default Header;