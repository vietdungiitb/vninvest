import { createElement, useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './vertical/sidebar/Sidebar';
import { Header } from './vertical/header/Header';
import { cn } from '@/lib/utils';

const e = createElement;

export function FullLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    if (window.innerWidth >= 1024) {
      setSidebarCollapsed(prev => !prev);
    } else {
      setMobileSidebarOpen(prev => !prev);
    }
  };

  const closeMobileSidebar = () => {
    setMobileSidebarOpen(false);
    setSidebarCollapsed(true);
  };

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isSidebarOpen = window.innerWidth >= 1024 ? !sidebarCollapsed : mobileSidebarOpen;

  return e(
    'div',
    { className: 'min-h-screen bg-slate-950 text-slate-100 font-sans flex relative overflow-hidden' },
    // Sidebar backdrop overlay
    isSidebarOpen && e(
      'div',
      {
        className: 'fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity duration-300 lg:hidden',
        onClick: closeMobileSidebar,
        'aria-hidden': 'true'
      }
    ),
    // Sidebar
    e(Sidebar, {
      collapsed: sidebarCollapsed,
      onToggle: toggleSidebar,
      mobileOpen: mobileSidebarOpen,
      onMobileClose: closeMobileSidebar
    }),
    // Main content area
    e(
      'div',
      {
        className: cn(
          'flex-1 flex flex-col min-w-0 w-full transition-all duration-300',
          sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-72'
        )
      },
      // Header
      e(Header, {
        onMenuClick: toggleSidebar,
        sidebarCollapsed,
        mobileSidebarOpen
      }),
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

export default FullLayout;