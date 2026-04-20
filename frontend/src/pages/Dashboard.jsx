import React from 'react';
import { useInterface } from '../context/InterfaceContext';
import LegacyDashboard from './LegacyDashboard';
import ModernDashboard from './modern/ModernDashboard';

/**
 * Dashboard Dispatcher:
 * Switches between Legacy and Modern workstation layouts based on user preference.
 */
export default function Dashboard() {
  const { uiMode } = useInterface();

  if (uiMode === 'modern') {
    return <ModernDashboard />;
  }

  return <LegacyDashboard />;
}
