import { FullLayout } from './full/FullLayout';

/**
 * AppShell - Main layout wrapper using FullLayout from template
 * This replaces the old custom AppShell with the new template-based layout
 */
export function AppShell() {
  return <FullLayout />;
}

export default AppShell;