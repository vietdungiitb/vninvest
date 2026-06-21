/**
 * AppShell - Responsive layout with Sidebar and Header
 * Uses Tailwind CSS classes following the template design system
 * Convention: createElement pattern (no JSX in packages/web)
 */
import { createElement, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext.js';
import { useI18n } from '../context/LangContext.js';
import { authTokenStorage } from '../adapters/coreApiAdapter.js';

const e = createElement;

export function AppShell() {
  const { userIdentity = {}, logout, userTenants = [], switchTenant, activeTenantId } = usePortfolio();
  const { t, locale, setLanguage } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleTenantChange = (e) => {
    switchTenant(e.target.value);
  };

  const handleLanguageChange = (e) => {
    setLanguage(e.target.value);
  };

  const sidebarItems = [
    { labelKey: 'layout.nav.dashboard', path: '/dashboard', icon: '📊' },
    { labelKey: 'layout.nav.watchlist', path: '/watchlist', icon: '⭐️' },
    { labelKey: 'layout.nav.screener', path: '/screener', icon: '🔍' },
    { labelKey: 'layout.nav.transactions', path: '/transactions', icon: '💸' },
    { labelKey: 'layout.nav.portfolios', path: '/portfolios', icon: '💼' },
    { labelKey: 'layout.nav.whaleAlerts', path: '/whale-alerts', icon: '🐋' },
    { labelKey: 'layout.nav.aiAdvisory', path: '/ai-advisory', icon: '🧠' },
    { labelKey: 'layout.nav.upgrade', path: '/upgrade', icon: '🚀' },
    { labelKey: 'layout.nav.support', path: '/support', icon: '💬' },
    { labelKey: 'layout.nav.settings', path: '/settings', icon: '⚙️' },
    { labelKey: 'layout.nav.aiCommandCenter', path: '/settings/ai', icon: '🧠' },
    { labelKey: 'layout.nav.soc', path: '/operations-center', icon: '🛠️' },
    { labelKey: 'layout.nav.adminCrawlControl', path: '/admin-crawl-control', icon: '🔄' },
    { labelKey: 'layout.nav.alertCenter', path: '/alert-center', icon: '🔔' },
    { labelKey: 'layout.nav.tenantAdmin', path: '/tenant-admin', icon: '🏢' },
  ];

  const [wsStatus, setWsStatus] = useState('connecting');

  useEffect(() => {
    setWsStatus('connected');
  }, []);

  const toggleSidebar = () => {
    if (window.innerWidth >= 1024) {
      setSidebarCollapsed(!sidebarCollapsed);
    } else {
      setMobileSidebarOpen(!mobileSidebarOpen);
    }
  };

  return e(
    'div',
    { className: 'min-h-screen bg-slate-950 text-slate-100 font-sans flex relative overflow-hidden' },
    // Sidebar backdrop overlay (visible when sidebar is open on either desktop or mobile)
    ((window.innerWidth >= 1024 ? !sidebarCollapsed : mobileSidebarOpen)) && e(
      'div',
      {
        className: 'fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity duration-300',
        onClick: () => {
          setSidebarCollapsed(true);
          setMobileSidebarOpen(false);
        },
        'aria-hidden': 'true'
      }
    ),
    // Sidebar (Floating Drawer)
    e(
      'aside',
      {
        className: `
          fixed top-0 bottom-0 left-0 z-50 flex flex-col h-screen w-72 bg-slate-900 border-r border-slate-800
          transition-transform duration-300 ease-in-out shadow-2xl
          ${(window.innerWidth >= 1024 ? !sidebarCollapsed : mobileSidebarOpen) ? 'translate-x-0' : '-translate-x-full'}
        `,
        role: 'navigation',
        'aria-label': t('layout.nav.group.dashboard') || 'Main navigation'
      },
      // Logo & Workspace Selector
      e(
        'div',
        { className: 'flex flex-col border-b border-slate-800 p-4 sidebar-sticky-header' },
        e(
          'div',
          { className: 'flex items-center justify-between mb-4' },
          e(
            'h1',
            {
              className: 'text-xl font-bold text-cyan-400 tracking-tight'
            },
            'VNInvest'
          ),
          e(
            'button',
            {
              className: 'p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 focus:outline-none',
              onClick: () => {
                setSidebarCollapsed(true);
                setMobileSidebarOpen(false);
              },
              'aria-label': t('layout.collapseMenu') || 'Close menu'
            },
            '✕'
          )
        ),
        userTenants.length > 0 && e(
          'div',
          { className: 'mt-4' },
          e(
            'label',
            {
              className: 'block text-xs text-slate-500 mb-1',
              htmlFor: 'workspace-select'
            },
            t('layout.workspace') || 'Workspace'
          ),
          e(
            'select',
            {
              id: 'workspace-select',
              value: activeTenantId || '',
              onChange: handleTenantChange,
              className: 'w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg p-2.5 focus:border-cyan-400 focus:outline-none cursor-pointer',
              'aria-label': t('layout.workspace') || 'Select workspace'
            },
            userTenants.map(t => e(
              'option',
              {
                key: t.tenant_id || t.public_id || t.id,
                value: t.tenant_id || t.public_id || t.id
              },
              `${t.display_name} (${(t.plan || 'free').toUpperCase()})`
            ))
          )
        )
      ),
      // Navigation Menu
      e(
        'nav',
        {
          className: 'flex-1 overflow-y-auto p-4 space-y-1',
          role: 'menubar'
        },
        sidebarItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          return e(
            Link,
            {
              key: item.path,
              to: item.path,
              className: `
                flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors
                ${isActive
                  ? 'bg-slate-800/60 text-cyan-400 border-l-2 border-cyan-400 font-semibold'
                  : 'text-slate-400 hover:bg-slate-800/30 hover:text-slate-200'
                }
              `,
              role: 'menuitem',
              'aria-current': isActive ? 'page' : undefined,
              onClick: () => {
                setMobileSidebarOpen(false);
                setSidebarCollapsed(true);
              },
              title: t(item.labelKey) || item.labelKey
            },
            e('span', { className: 'text-base flex-shrink-0' }, item.icon),
            e('span', { className: 'truncate' }, t(item.labelKey) || item.labelKey)
          );
        })
      ),
      // Profile Block (bottom)
      e(
        'div',
        { className: 'p-4 border-t border-slate-800 bg-slate-950/50' },
        e('div', { className: 'font-medium text-slate-100 truncate' }, userIdentity.username || 'User'),
        e('div', { className: 'text-xs text-slate-500 truncate mt-1' }, userIdentity.email || ''),
        e(
          'button',
          {
            onClick: handleLogout,
            className: 'w-full mt-3 py-2 rounded-lg font-medium transition-colors bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20',
            type: 'button'
          },
          t('layout.logout') || 'Đăng xuất'
        )
      )
    ),
    // Main content area
    e(
      'div',
      {
        className: 'flex-1 flex flex-col min-w-0 w-full'
      },
      // Topbar Header
      e(
        'header',
        {
          className: 'sticky top-0 z-30 h-18 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6',
          role: 'banner'
        },
        // Left: Hamburger + Breadcrumbs
        e(
          'div',
          { className: 'flex items-center gap-4' },
          e(
            'button',
            {
              className: 'p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 focus:outline-none transition-colors duration-200',
              onClick: toggleSidebar,
              'aria-label': t('layout.expandMenu') || 'Open menu',
              'aria-expanded': !sidebarCollapsed || mobileSidebarOpen
            },
            '☰'
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
          { className: 'flex-1 max-w-md mx-8 hidden md:block' },
          e(
            'input',
            {
              type: 'text',
              placeholder: t('layout.searchPlaceholder') || 'Tìm mã cổ phiếu...',
              className: 'w-full bg-slate-800 border border-slate-800 text-slate-200 text-sm rounded-lg px-4 py-2 focus:border-cyan-400 focus:outline-none placeholder:text-slate-500',
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
              className: `
                w-2 h-2 rounded-full
                ${wsStatus === 'connected' ? 'bg-emerald-400 live-dot-pulse' : 'bg-rose-400'}
              `,
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
          // Notification Bell
          e(
            'button',
            {
              className: 'relative p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800',
              'aria-label': t('layout.notifications') || 'Notifications'
            },
            '🔔',
            e(
              'span',
              { className: 'absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-[10px] font-bold rounded-full flex items-center justify-center' },
              '3'
            )
          ),
          // User Avatar
          e(
            'div',
            { className: 'w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold' },
            (userIdentity.username || 'U')[0].toUpperCase()
          )
        )
      ),
      // Main Content
      e(
        'main',
        {
          className: 'flex-1 p-6 overflow-auto',
          role: 'main'
        },
        e('div', { className: 'max-w-7xl mx-auto' }, e(Outlet))
      )
    )
  );
}

export default AppShell;