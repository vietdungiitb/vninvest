import { createElement, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { usePortfolio } from "../context/PortfolioContext.js";
import { useI18n } from "../context/LangContext.js";
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
  const { t } = useI18n();
  const location = useLocation();
  const isStaff = Boolean(userIdentity?.isStaff || userIdentity?.isSuperuser);
  // E4 (P1): this used to be the literal string "common.noPermission". There was
  // no t() call anywhere in the file and ShellToast.tsx:119 renders {message}
  // raw, so a non-staff user deep-linking to a staff route was shown the raw
  // i18n key instead of a sentence.
  const noPermissionMessage = t("common.noPermission", {
    defaultValue: "Bạn không có quyền truy cập trang này.",
  });

  useEffect(() => {
    if (!isStaff) {
      toast.warning(noPermissionMessage);
    }
  }, [isStaff, noPermissionMessage, toast]);

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
