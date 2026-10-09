import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { useToast } from "../../components/ShellToast.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
// WAVE 6 / NAV-1 — hook URL có sẵn (không thêm dependency). `useUrlValue` gọi
// `useSearchParams` ⇒ component **bắt buộc** nằm trong `<Router>`; test tương ứng
// đã bọc `MemoryRouter` (xem `soc-users.component.test.tsx`).
import { useUrlValue, intCodec, stringCodec } from "../../hooks/useUrlState";
import styles from "./soc.module.css";

const e = createElement;

interface SocUserRow {
  id?: number;
  username?: string;
  email?: string;
  full_name?: string;
  is_active?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  date_joined?: string | null;
  last_login?: string | null;
  tenant?: { tenant_code?: string; display_name?: string; plan?: string; status?: string } | null;
  member_of?: Array<{ tenant_code?: string; role?: string }>;
}

const socUsersAdapter = defaultCoreApiAdapter as unknown as {
  getSocUsers: (params: Record<string, string | number>) => Promise<{
    results?: SocUserRow[]; count?: number;
  }>;
  setSocUserActive: (id: number, body: { is_active: boolean; reason: string }) => Promise<unknown>;
  setSocUserPlan: (id: number, body: { plan: string; reason: string }) => Promise<unknown>;
};

const PLANS = ["free", "starter", "pro", "enterprise", "custom", "internal"];
const STATUSES = ["active", "suspended", "deprovisioned", "none"];
const PAGE_SIZE = 20;

function formatTime(iso?: string | null, locale = "vi-VN"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(locale);
}

function Badge({ tone, children }: { tone: "ok" | "off" | "info"; children: React.ReactNode }) {
  const cls = tone === "ok" ? styles.statusBadgeOk : tone === "info" ? styles.statusBadgeInfo : styles.statusBadgeOff;
  return e("span", { className: `${styles.statusBadge} ${cls}` },
    e("span", { className: styles.statusDot }), children);
}

export function SocUsersPanel() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<SocUserRow[]>([]);
  const [total, setTotal] = useState(0);
  // WAVE 6 / NAV-1 — phân trang + bộ lọc đồng bộ URL (deep-link + nút Back + F5).
  // `page` dùng `intCodec`; ô nhập `search` dùng `replace: true` vì gắn thẳng
  // `onChange` — không thì **mỗi ký tự** đẩy 1 history entry (lỗi đã xảy ra wave 4).
  const [page, setPage] = useUrlValue("users_page", intCodec, 1);
  const [search, setSearch] = useUrlValue("users_q", stringCodec, "", { replace: true });
  const [plan, setPlan] = useState("");
  const [statusFilter, setStatusFilter] = useUrlValue("users_status", stringCodec, "", { replace: true });
  const [staffFilter, setStaffFilter] = useUrlValue("users_staff", stringCodec, "", { replace: true });
  const [activeFilter, setActiveFilter] = useUrlValue("users_active", stringCodec, "", { replace: true });
  const [planModal, setPlanModal] = useState<{ id: number; username?: string; plan: string } | null>(null);
  const [lockTarget, setLockTarget] = useState<{ id: number; username?: string; next: boolean } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tag = locale === "en" ? "en-US" : "vi-VN";
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await socUsersAdapter.getSocUsers({
        page: pageNum, page_size: PAGE_SIZE, search, plan,
        status: statusFilter, is_staff: staffFilter, is_active: activeFilter,
      });
      setRows(res.results || []);
      setTotal(res.count || 0);
      // ⚠ KHÔNG `setPage(pageNum)` ở đây: `load` chạy trong effect debounce, mỗi
      // lần ghi `setParams` là 1 history entry ⇒ lọc 1 lần là sinh entry thừa.
      // Việc đồng bộ trang do **người dùng bấm nút trang** đảm nhiệm; reset về
      // trang 1 khi đổi bộ lọc nằm ở effect bên dưới (có so sánh trước).
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("soc.users.load_fail"));
    } finally {
      setLoading(false);
    }
  }, [t, search, plan, statusFilter, staffFilter, activeFilter]);

  // Đổi bộ lọc ⇒ nạp lại và về trang 1 (giữ hành vi cũ).
  //
  // ⚠ **KHÔNG để `page` trong deps.** `load` không phụ thuộc `page` (nó nhận
  // `pageNum` qua tham số), nên effect này chỉ chạy lại khi **bộ lọc** đổi.
  // Trước đây `page` nằm trong deps ⇒ mỗi lần bấm nút trang, effect chạy lại và
  // `setPage(1)` **đè mất** lựa chọn của người dùng. Bắt được bởi test `W6-1`
  // (`users_page=1` thay vì `2`) — đúng loại bug "test xanh nhưng tính năng hỏng".
  //
  // `filterKey` gom các bộ lọc thành chuỗi: so sánh chuỗi ổn định hơn so sánh 5
  // biến riêng lẻ (useEffect so sánh tham chiếu).
  const filterKey = `${search}|${plan}|${statusFilter}|${staffFilter}|${activeFilter}`;
  const firstFilterRunRef = useRef(true);
  // `page` đọc qua ref: effect theo dõi **bộ lọc** mà vẫn nạp đúng trang hiện
  // tại (kể cả trang tới từ deep-link). Không đưa `page` vào deps — xem giải thích
  // ở effect bên dưới.
  const pageRef = useRef(page);
  pageRef.current = page;
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Lần chạy đầu (mount): giữ `page` từ deep-link, KHÔNG reset.
    if (firstFilterRunRef.current) {
      firstFilterRunRef.current = false;
    } else if (page !== 1) {
      setPage(1);
      return; // load(1) chạy ở effect kế tiếp, sau khi `page` đã về 1.
    }
    debounceRef.current = setTimeout(() => { load(pageRef.current); }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  async function handleLockConfirm() {
    if (!lockTarget) return;
    if (reason.trim().length < 5) {
      setError(t("soc.users.reason_required"));
      return;
    }
    setBusy(true);
    try {
      await socUsersAdapter.setSocUserActive(
        lockTarget.id, { is_active: lockTarget.next, reason: reason.trim() });
      toast.success(t("soc.users.action_ok"));
      setLockTarget(null);
      setReason("");
      await load(page);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("soc.users.action_fail"));
    } finally {
      setBusy(false);
    }
  }

  async function handlePlanSubmit() {
    if (!planModal) return;
    if (reason.trim().length < 5) {
      setError(t("soc.users.reason_required"));
      return;
    }
    setBusy(true);
    try {
      await socUsersAdapter.setSocUserPlan(planModal.id, { plan: planModal.plan, reason: reason.trim() });
      toast.success(t("soc.users.action_ok"));
      setPlanModal(null);
      setReason("");
      await load(page);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("soc.users.action_fail"));
    } finally {
      setBusy(false);
    }
  }

  function handleExportCsv() {
    const header = ["username", "email", "tenant", "plan", "active", "staff", "last_login"];
    const lines = rows.map((r) => [
      r.username || "", r.email || "", r.tenant?.tenant_code || "",
      r.tenant?.plan || "", r.is_active ? "yes" : "no",
      (r.is_staff || r.is_superuser) ? "yes" : "no",
      r.last_login || "",
    ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")],
      { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "soc-users.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading && rows.length === 0) {
    return e("div", { className: styles.glassPanel }, t("soc.users.loading"));
  }

  return e("div", null,
    e("div", { className: styles.glassPanel },
      e("p", { className: styles.metricLabel }, "SOC / " + t("soc.users.eyebrow")),
      e("h2", { className: styles.sectionCardTitle }, t("soc.users.title")),
      e("p", { className: styles.metricLabel }, t("soc.users.subtitle")),
    ),
    error ? e("p", { className: styles.inlineError }, error) : null,

    e("div", { className: styles.sectionCard },
      e("h3", { className: styles.sectionCardTitle },
        t("soc.users.bulk_title") + ` (${total})`),
      e("div", { className: styles.metricGrid },
        e("input", {
          type: "text", value: search, placeholder: t("soc.users.search_ph"),
          onChange: (ev: { target: { value: string } }) => setSearch(ev.target.value),
          className: styles.searchInput,
        }),
        e("select", {
          value: plan, onChange: (ev: { target: { value: string } }) => setPlan(ev.target.value),
        }, [e("option", { key: "", value: "" }, t("soc.users.filter_plan")),
          ...PLANS.map((p) => e("option", { key: p, value: p }, p))]),
        e("select", {
          value: statusFilter, onChange: (ev: { target: { value: string } }) => setStatusFilter(ev.target.value),
        }, [e("option", { key: "", value: "" }, t("soc.users.filter_status")),
          ...STATUSES.map((s) => e("option", { key: s, value: s }, s))]),
        e("select", {
          value: staffFilter, onChange: (ev: { target: { value: string } }) => setStaffFilter(ev.target.value),
        }, [e("option", { key: "", value: "" }, t("soc.users.filter_staff")),
          e("option", { key: "t", value: "true" }, t("soc.users.yes")),
          e("option", { key: "f", value: "false" }, t("soc.users.no"))]),
        e("select", {
          value: activeFilter, onChange: (ev: { target: { value: string } }) => setActiveFilter(ev.target.value),
        }, [e("option", { key: "", value: "" }, t("soc.users.filter_active")),
          e("option", { key: "t", value: "true" }, t("soc.users.yes")),
          e("option", { key: "f", value: "false" }, t("soc.users.no"))]),
      ),
      e("div", null,
        e("button", { type: "button", className: styles.actionBtn, onClick: handleExportCsv },
          t("soc.users.export_csv"))),
      rows.length === 0
        ? e("p", { className: styles.metricLabel }, t("soc.users.empty"))
        : e("div", { className: styles.socDataTableWrap },
          e("table", { className: styles.socDataTable },
            e("thead", null, e("tr", null,
              [t("soc.users.col_user"), t("soc.users.col_email"), t("soc.users.col_tenant"),
               t("soc.users.col_plan"), t("soc.users.col_active"), t("soc.users.col_staff"),
               t("soc.users.col_last_login"), t("soc.users.col_actions")].map((h, i) =>
                e("th", { key: i }, h)))),
            e("tbody", null, rows.map((r) => e("tr", { key: r.id },
              e("td", null,
                e("strong", null, r.username || ""),
                r.full_name ? e("div", { className: styles.metricLabel }, r.full_name) : null),
              e("td", { className: styles.socDataCellWrap }, r.email || "—"),
              e("td", null,
                r.tenant?.tenant_code || "—",
                (r.member_of || []).length > 0
                  ? e("div", { className: styles.metricLabel },
                      (r.member_of || []).map((m) => `${m.tenant_code} (${m.role})`).join(", "))
                  : null),
              e("td", null, r.tenant?.plan
                ? e(Badge, { tone: "info", children: r.tenant.plan }) : "—"),
              e("td", null, e(Badge, { tone: r.is_active ? "ok" : "off", children: r.is_active ? t("soc.users.yes") : t("soc.users.no") })),
              e("td", null, (r.is_staff || r.is_superuser)
                ? e(Badge, { tone: "info", children: t("soc.users.yes") })
                : e(Badge, { tone: "off", children: t("soc.users.no") })),
              e("td", null, r.last_login ? formatTime(r.last_login, tag) : "—"),
              e("td", null,
                e("button", {
                  type: "button", className: styles.actionBtn, disabled: busy,
                  onClick: () => setLockTarget({ id: r.id || 0, username: r.username, next: !r.is_active }),
                }, r.is_active ? t("soc.users.lock_btn") : t("soc.users.unlock_btn")),
                e("button", {
                  type: "button", className: styles.actionBtn, disabled: busy,
                  onClick: () => { setReason(""); setPlanModal({ id: r.id || 0, username: r.username, plan: r.tenant?.plan || "free" }); },
                }, t("soc.users.plan_btn"))) ))))) ,
      e("div", { className: styles.metricLabel },
        e("button", {
          type: "button", className: styles.actionBtn,
          // WAVE 6: `load` **không** tự ghi `page` nữa ⇒ nút phải ghi URL
          // (không `replace`: người dùng muốn Back quay trang trước).
          disabled: page <= 1 || loading,
          onClick: () => { const next = Math.max(1, page - 1); setPage(next); load(next); },
        }, "‹"),
        ` ${t("soc.users.page_of", { page, pages: totalPages, total })} `,
        e("button", {
          type: "button", className: styles.actionBtn,
          disabled: loading || page >= totalPages,
          onClick: () => { const next = page + 1; setPage(next); load(next); },
        }, "›")),
    ),

    lockTarget ? e("div", { className: styles.sectionCard },
      e("h3", { className: styles.sectionCardTitle },
        (lockTarget.next ? t("soc.users.unlock_title") : t("soc.users.lock_title"))
        + ` ${lockTarget.username || ""}`),
      e("input", {
        type: "text", value: reason, placeholder: t("soc.users.reason_ph"),
        onChange: (ev: { target: { value: string } }) => setReason(ev.target.value),
        className: styles.searchInput,
      }),
      e("div", null,
        e("button", { type: "button", className: styles.actionBtn, disabled: busy, onClick: handleLockConfirm },
          t("soc.users.lock_confirm")),
        e("button", {
          type: "button", className: styles.actionBtn,
          onClick: () => { setLockTarget(null); setReason(""); },
        }, t("soc.users.cancel"))),
    ) : null,

    planModal ? e("div", { className: styles.sectionCard },
      e("h3", { className: styles.sectionCardTitle },
        t("soc.users.plan_title") + ` ${planModal.username || ""}`),
      e("select", {
        value: planModal.plan,
        onChange: (ev: { target: { value: string } }) =>
          setPlanModal({ ...planModal, plan: ev.target.value }),
      }, PLANS.map((p) => e("option", { key: p, value: p }, p))),
      e("input", {
        type: "text", value: reason, placeholder: t("soc.users.reason_ph"),
        onChange: (ev: { target: { value: string } }) => setReason(ev.target.value),
        className: styles.searchInput,
      }),
      e("div", null,
        e("button", { type: "button", className: styles.actionBtn, disabled: busy, onClick: handlePlanSubmit },
          t("soc.users.plan_submit")),
        e("button", {
          type: "button", className: styles.actionBtn,
          onClick: () => { setPlanModal(null); setReason(""); },
        }, t("soc.users.cancel"))),
    ) : null,
  );
}
