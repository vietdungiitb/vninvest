import { Outlet } from 'react-router-dom';
import { TenantAdminSidebar } from './TenantAdminSidebar.js';
import { Breadcrumb } from './Breadcrumb.js';
import { PageTransition } from './PageTransition.js';
import { TenantAdminErrorBoundary } from './TenantAdminErrorBoundary.js';
const LAYOUT_CSS = `
.taLayout {
  display: flex;
  min-height: 100vh;
}
.taLayout__main {
  flex: 1;
  padding: 24px;
  overflow-x: hidden;
}

@media (max-width: 1024px) {
  .taLayout__main {
    padding: 16px;
  }
}
@media (max-width: 768px) {
  .taLayout__main {
    padding: 12px;
  }
}

.shellPage table,
.shellPage .MuiTable-root {
  display: block;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
@media (max-width: 768px) {
  .shellPage thead,
  .shellPage .MuiTableHead-root {
    display: none;
  }
  .shellPage tbody tr,
  .shellPage .MuiTableBody-root .MuiTableRow-root {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-shell);
    border-radius: 10px;
    padding: 12px;
    margin-bottom: 8px;
    background: var(--bg-shell-surface);
  }
  .shellPage td,
  .shellPage th,
  .shellPage .MuiTableCell-root {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    border-bottom: none;
    font-size: 13px;
  }
  .shellPage td::before {
    content: attr(data-label);
    font-weight: 600;
    color: var(--text-secondary);
    margin-right: 12px;
    flex-shrink: 0;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .shellPage button,
  .shellPage [role="button"],
  .shellPage input,
  .shellPage select,
  .shellPage textarea,
  .shellPage .MuiButtonBase-root {
    min-height: 44px;
    min-width: 44px;
  }
}
`;

export function TenantAdminLayout() {
  return (
    <div className="taLayout">
      <style>{LAYOUT_CSS}</style>
      <TenantAdminSidebar />
      <main className="taLayout__main">
        <Breadcrumb />
        <TenantAdminErrorBoundary>
          <PageTransition>
            <Outlet />
          </PageTransition>
        </TenantAdminErrorBoundary>
      </main>
    </div>
  );
}
