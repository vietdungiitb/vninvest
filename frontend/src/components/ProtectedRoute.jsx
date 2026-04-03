/**
 * components/ProtectedRoute.jsx
 * Route guard theo CASL ability — chặn truy cập trang nếu không có quyền.
 *
 * Dùng trong App.jsx:
 *   <Route path="/whale-advisory" element={
 *     <ProtectedRoute action="read" subject="WhaleAdvisory">
 *       <WhaleAdvisoryPage />
 *     </ProtectedRoute>
 *   } />
 */
import { Navigate } from 'react-router-dom';
import { useAbility } from '../context/AbilityContext';

export default function ProtectedRoute({
  action,
  subject,
  redirectTo = '/upgrade',
  children,
}) {
  const ability = useAbility();
  if (!ability.can(action, subject)) {
    return <Navigate to={redirectTo} replace />;
  }
  return children;
}
