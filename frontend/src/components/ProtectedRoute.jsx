/**
 * components/ProtectedRoute.jsx
 * Route guard theo CASL ability — chặn truy cập trang nếu không có quyền.
 *
 * Dùng trong App.jsx:
 *   <Route path="/ai-advisory" element={
 *     <ProtectedRoute action="read" subject="WhaleAdvisory">
 *       <WhaleAdvisoryPage />
 *     </ProtectedRoute>
 *   } />
 */
import { Navigate } from 'react-router-dom';
import { useAbility } from '../context/AbilityContext';
import { usePortfolio } from '../context/PortfolioContext';

export default function ProtectedRoute({
  action,
  subject,
  redirectTo = '/upgrade',
  children,
}) {
  const ability = useAbility();
  const { isAuthenticated, authStateReady } = usePortfolio();

  // Delay entitlement check until auth bootstrap finishes after hard refresh.
  if (isAuthenticated && !authStateReady) {
    return (
      <div className="mx-auto flex min-h-[40vh] w-full items-center justify-center text-slate-400">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-400/80" />
      </div>
    );
  }

  if (!ability.can(action, subject)) {
    return <Navigate to={redirectTo} replace />;
  }
  return children;
}
