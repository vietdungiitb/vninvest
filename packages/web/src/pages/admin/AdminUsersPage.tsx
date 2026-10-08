import { createElement } from "react";
import { SocUsersPanel } from "../../components/soc/SocUsersPanel.js";
import { AdminPageHeader } from "./adminUi.js";
import { useI18n } from "../../context/LangContext.js";

const e = createElement;

/**
 * P0 (admin-users-move): trang Quản trị người dùng trong nhóm Quản trị main menu.
 * Tái dùng SocUsersPanel (staff-only qua BE + route guard nếu có).
 *
 * FU-02c: trang này chỉ `return e(SocUsersPanel)` mà `SocUsersPanel` chỉ có
 * `h2`/`h3` ⇒ route không có `<h1>` nào. Dùng `AdminPageHeader` như 4 trang
 * admin còn lại (render `<h1>` ở `adminUi.tsx:25`).
 */
export function AdminUsersPage() {
  const { t } = useI18n();
  return e(
    "div",
    { className: "admin-users-page" },
    e(AdminPageHeader, { title: t("routes.adminUsers") }),
    e(SocUsersPanel, null),
  );
}
