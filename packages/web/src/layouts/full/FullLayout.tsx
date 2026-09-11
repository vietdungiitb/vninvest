import { createElement, useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './vertical/sidebar/Sidebar';
import { Header } from './vertical/header/Header';
import { isNewLayoutEnabled } from '../../lib/runtimeConfig';
import { cn } from '@/lib/utils';

const e = createElement;

export function FullLayout() {
  const newLayout = isNewLayoutEnabled();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(newLayout ? false : true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    if (newLayout) {
      setMobileSidebarOpen(prev => !prev);
    } else {
      if (window.innerWidth >= 1024) {
        setSidebarCollapsed(prev => !prev);
      } else {
        setMobileSidebarOpen(prev => !prev);
      }
    }
  };

  const closeMobileSidebar = () => {
    setMobileSidebarOpen(false);
    if (!newLayout) {
      setSidebarCollapsed(true);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return e(
    'div',
    { className: 'min-h-screen bg-[var(--color-bg-primary)] text-slate-100 font-sans flex relative overflow-hidden' },
    // Sidebar backdrop overlay
    mobileSidebarOpen && e(
      'div',
      {
        className: cn(
          'fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity duration-300',
          !newLayout && 'lg:hidden'
        ),
        onClick: closeMobileSidebar,
        'aria-hidden': 'true'
      }
    ),
    // Sidebar
    e(Sidebar, {
      collapsed: newLayout ? false : sidebarCollapsed,
      onToggle: newLayout ? undefined : toggleSidebar,
      mobileOpen: mobileSidebarOpen,
      onMobileClose: closeMobileSidebar
    }),
    // Main content area
    e(
      'div',
      {
        className: cn(
          'flex-1 flex flex-col min-w-0 w-full transition-all duration-300',
          newLayout
            ? 'lg:pl-0'
            : sidebarCollapsed
              ? 'lg:pl-[var(--layout-sidebar-collapsed-width)]'
              : 'lg:pl-[var(--layout-sidebar-width)]'
        )
      },
      // Header
      e(Header, {
        onMenuClick: toggleSidebar,
        sidebarCollapsed: newLayout ? false : sidebarCollapsed,
        mobileSidebarOpen
      }),
      // Main Content
      e(
        'main',
        {
          className: 'flex-1 p-[var(--sp-6,1.5rem)] overflow-auto',
          role: 'main'
        },
        e('div', { className: 'max-w-[var(--layout-content-max-width,80rem)] mx-auto' }, e(Outlet))
      )
    )
  );
}

export default FullLayout;
