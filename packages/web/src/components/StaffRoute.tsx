import { createElement, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { usePortfolio } from "../context/PortfolioContext.js";
import { useToast } from "./ShellToast.js";

const e = createElement;

/**
 * R0 (tenant-admin-refactor): route guard staff-only cho khu Quản trị.
 * Dùng BÊN TRONG ProtectedRoute (đã đảm bảo authenticated).
 * Non-staff → toast notice + redirect /dashboard.
 */
export function StaffRoute({ children }: { children: React.ReactNode }) {
  const { userIdentity } = usePortfolio() as any;
  const toast = useToast();
  const location = useLocation();
  const isStaff = Boolean(userIdentity?.isStaff || userIdentity?.isSuperuser);

  useEffect(() => {
    if (!isStaff) {
      toast.warning("common.noPermission");
    }
  }, [isStaff, toast]);

  if (!isStaff) {
    return e(Navigate, { to: "/dashboard", replace: true, state: { from: location.pathname } });
  }
  return children as React.ReactElement;
}

/**
 * R0: guard cần-tenant cho /tenant/* và /tenant-admin/*.
 * Giữ quyền owner tự quản (không bọc staff) — chỉ chặn user không tenant.
 */
export function TenantRoute({ children }: { children: React.ReactNode }) {
  const { userTenants } = usePortfolio() as any;
  const location = useLocation();
  const hasTenant = Array.isArray(userTenants) && userTenants.length > 0;
  if (!hasTenant) {
    return e(Navigate, { to: "/dashboard", replace: true, state: { from: location.pathname } });
  }
  return children as React.ReactElement;
}
