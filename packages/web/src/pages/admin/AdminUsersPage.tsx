import { createElement } from "react";
import { SocUsersPanel } from "../../components/soc/SocUsersPanel.js";

const e = createElement;

/**
 * P0 (admin-users-move): trang Quản trị người dùng trong nhóm Quản trị main menu.
 * Tái dùng SocUsersPanel (staff-only qua BE + route guard nếu có).
 */
export function AdminUsersPage() {
  return e(SocUsersPanel);
}
