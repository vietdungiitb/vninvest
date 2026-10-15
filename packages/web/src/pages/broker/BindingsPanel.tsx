/**
 * mbw3 B3.1 — BindingsPanel: tab "Gộp danh mục" (contract §2 đóng băng).
 *
 * - List từ `GET workspace/portfolios/<id>/broker-bindings/` (BE-READ),
 *   envelope `[{binding_id, sub_account_id, provider, external_id,
 *   display_name, role, is_default}]` — không hardcode (AC1).
 * - Add/remove confirm 2 bước + role select (mặc định `secondary`) (AC2).
 * - Convert kind theo bảng chuyển làn §2 qua PATCH hiện có
 *   `{action:'convert', kind}` (không thêm route). Gợi ý client-side mirror
 *   bảng BE; BE vẫn là nguồn sự thật (từ chối kèm code) (AC2).
 * - `kind` vắng (BE chưa deploy BE-KIND) ⇒ khóa convert fail-closed (AC3 FE).
 *
 * Mount đề xuất (ngoài phạm vi file slice này — xem evidence): section mới
 * dưới `BrokerSyncCenter` trong `BrokerAccountPage` (`/broker/accounts/:id`),
 * truyền `accountId` để preselect. Panel KHÔNG tự đọc URL (form-local
 * useState; host page sở hữu URL) nên mount ở đâu cũng được.
 *
 * Luật sắt: hằng option cấp module (L-F10); không setSearchParams ở đây
 * (không tranh URL với host); mọi chuỗi qua `t("brokerWave3.bindings.*")`.
 */
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { ProviderBadge } from "../../components/brokerData/sourceBadge";
import "../../components/brokerData/brokerData.css";

export interface BindingRow {
  binding_id?: string | number;
  sub_account_id: string | number;
  provider?: string | null;
  external_id?: string | null;
  display_name?: string | null;
  role?: string | null;
  is_default?: boolean;
}

export interface BrokerAccountOption {
  id: string | number;
  provider?: string | null;
  external_id?: string | null;
  display_name?: string | null;
}

export interface PortfolioOption {
  id: string | number;
  name?: string | null;
  kind?: string | null;
}

export interface BindingsPanelAdapter {
  // Loop Stage 6 (mount crash): 3 ham doc la optional — adapter khuyet
  // (mock test, facade cu) khong duoc lam crash ca trang. Thieu ham doc
  // nao thi danh sach do rong. Ham ghi giu bat buoc (write can adapter du).
  getPortfolioBindings?: (portfolioId: string | number) => Promise<unknown>;
  savePortfolioBindings: (portfolioId: string | number, data: Record<string, unknown>) => Promise<unknown>;
  getBrokerAccounts?: () => Promise<unknown>;
  getPortfolios?: () => Promise<unknown>;
}

/** Cấp module (L-F10): type union ổn định cho convert select. */
const KIND_TARGETS = ["manual", "broker_backed", "aggregate"] as const;
type KindTarget = (typeof KIND_TARGETS)[number];

const ROLE_OPTIONS = ["primary", "secondary"] as const;

/** Bóc list khỏi envelope `{data}` / `{results}` / mảng phẳng. */
function asList(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>;
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as Array<Record<string, unknown>>;
    if (Array.isArray(obj.results)) return obj.results as Array<Record<string, unknown>>;
  }
  return [];
}

const panelApi = defaultCoreApiAdapter as unknown as BindingsPanelAdapter;

type ConfirmState =
  | { type: "add"; accountId: string | number; role: string }
  | { type: "remove"; accountId: string | number }
  | { type: "convert"; kind: KindTarget };

export function BindingsPanel({
  portfolioId,
  accountId,
  adapter,
}: {
  portfolioId?: string | number | null;
  accountId?: string | number | null;
  adapter?: BindingsPanelAdapter;
}) {
  const { t } = useI18n();
  const api = (adapter ?? panelApi) as BindingsPanelAdapter;
  const msg = useCallback(
    (key: string, defaultValue: string) => t(`brokerWave3.bindings.${key}`, { defaultValue }),
    [t],
  );

  const [portfolios, setPortfolios] = useState<PortfolioOption[]>([]);
  const [pickedId, setPickedId] = useState<string | number | null>(portfolioId ?? null);
  const effectiveId = portfolioId ?? pickedId;
  const [bindings, setBindings] = useState<BindingRow[]>([]);
  const [accounts, setAccounts] = useState<BrokerAccountOption[]>([]);
  const [kind, setKind] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [addAccountId, setAddAccountId] = useState<string | number | "">("");
  const [addRole, setAddRole] = useState<string>("secondary");
  const [convertKind, setConvertKind] = useState<KindTarget>("aggregate");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (effectiveId === null || effectiveId === undefined || effectiveId === "") {
      setBindings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [bRaw, aRaw, pRaw] = await Promise.all([
        typeof api.getPortfolioBindings === "function"
          ? api.getPortfolioBindings(effectiveId)
          : [],
        typeof api.getBrokerAccounts === "function"
          ? api.getBrokerAccounts().catch(() => [])
          : [],
        typeof api.getPortfolios === "function"
          ? api.getPortfolios().catch(() => [])
          : [],
      ]);
      setBindings(asList(bRaw) as unknown as BindingRow[]);
      setAccounts(asList(aRaw) as unknown as BrokerAccountOption[]);
      const plist = asList(pRaw) as unknown as PortfolioOption[];
      setPortfolios(plist);
      const self = plist.find((p) => String(p.id) === String(effectiveId));
      setKind(self ? (self.kind ?? null) : null);
      setLoading(false);
    } catch {
      setError(msg("loadError", "Không tải được danh sách gộp."));
      setLoading(false);
    }
  }, [api, effectiveId, msg]);

  useEffect(() => {
    // Portfolio picker (khi không truyền portfolioId): tải danh sách 1 lần.
    // Guard typeof: adapter khuyet getPortfolios thi picker rong, khong crash.
    if (
      (portfolioId === null || portfolioId === undefined) &&
      typeof api.getPortfolios === "function"
    ) {
      api
        .getPortfolios()
        .then((raw) => setPortfolios(asList(raw) as unknown as PortfolioOption[]))
        .catch(() => setPortfolios([]));
    }
  }, [api, portfolioId]);

  useEffect(() => {
    setPickedId(portfolioId ?? null);
  }, [portfolioId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    // Preselect tài khoản từ mount point (trang chi tiết tiểu khoản).
    if (accountId !== null && accountId !== undefined && accountId !== "") {
      setAddAccountId(accountId);
    }
  }, [accountId]);

  const boundIds = new Set(bindings.map((b) => String(b.sub_account_id)));
  const candidates = accounts.filter((a) => !boundIds.has(String(a.id)));
  const count = bindings.length;
  const kindKnown = kind === "manual" || kind === "broker_backed" || kind === "aggregate";

  /** Mirror bảng chuyển làn §2 (BE vẫn là nguồn sự thật). */
  const targetAllowed = (target: KindTarget): boolean => {
    if (!kindKnown) return false;
    if (target === kind) return false;
    if (target === "manual") return count === 0;
    if (target === "broker_backed") return count === 1;
    return count >= 1; // aggregate
  };

  const doSave = async (data: Record<string, unknown>, okKey: string, okDefault: string) => {
    if (effectiveId === null || effectiveId === undefined || effectiveId === "") return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api.savePortfolioBindings(effectiveId, data);
      setConfirm(null);
      setNotice(msg(okKey, okDefault));
      await reload();
    } catch {
      setError(msg("saveFail", "Không lưu được thay đổi gộp."));
    } finally {
      setSaving(false);
    }
  };

  const kindLabel = (k: string | null | undefined) =>
    k === "manual"
      ? msg("kindManual", "Thủ công")
      : k === "broker_backed"
        ? msg("kindBrokerBacked", "Môi giới")
        : k === "aggregate"
          ? msg("kindAggregate", "Tổng hợp")
          : msg("kindUnknown", "Không rõ");

  if (loading) {
    return <p role="status">{msg("loading", "Đang tải danh sách gộp…")}</p>;
  }

  return (
    <div className="bdata-wrap">
      <div className="bdata-head">
        <span className="bdata-title">{msg("title", "Gộp danh mục")}</span>
      </div>
      <p className="bdata-note" role="note">
        {msg("subtitle", "Gộp / tách tiểu khoản môi giới khỏi danh mục (xác nhận 2 bước).")}
      </p>

      {error ? <p role="alert">{error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}

      {(portfolioId === null || portfolioId === undefined) && (
        <label>
          {msg("pickPortfolio", "Danh mục")}
          <select
            value={pickedId === null ? "" : String(pickedId)}
            onChange={(e) => setPickedId(e.target.value === "" ? null : e.target.value)}
          >
            <option value="">—</option>
            {portfolios.map((p) => (
              <option key={String(p.id)} value={String(p.id)}>
                {p.name ?? `#${String(p.id)}`}
              </option>
            ))}
          </select>
        </label>
      )}

      {effectiveId !== null && effectiveId !== undefined && effectiveId !== "" ? (
        <>
          <h3>{msg("listHeading", "Tiểu khoản đang gộp")}</h3>
          {bindings.length === 0 ? (
            <p>{msg("empty", "Chưa gộp tiểu khoản nào vào danh mục này.")}</p>
          ) : (
            <table className="bdata-table">
              <thead>
                <tr>
                  <th scope="col">{msg("colAccount", "Tiểu khoản")}</th>
                  <th scope="col">{msg("colProvider", "Nhà môi giới")}</th>
                  <th scope="col">{msg("colRole", "Vai trò")}</th>
                  <th scope="col">{msg("colDefault", "Mặc định")}</th>
                  <th scope="col">{msg("colActions", "Thao tác")}</th>
                </tr>
              </thead>
              <tbody>
                {bindings.map((b) => (
                  <tr key={String(b.binding_id ?? b.sub_account_id)}>
                    <td>{b.display_name ?? b.external_id ?? String(b.sub_account_id)}</td>
                    <td>
                      <ProviderBadge provider={b.provider ?? null} />
                    </td>
                    <td>
                      {b.role === "primary"
                        ? msg("rolePrimary", "Chính")
                        : msg("roleSecondary", "Phụ")}
                    </td>
                    <td>{b.is_default ? msg("isDefault", "Mặc định") : "—"}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirm({ type: "remove", accountId: b.sub_account_id })
                        }
                      >
                        {msg("remove", "Tách")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3>{msg("addTitle", "Gộp thêm tiểu khoản")}</h3>
          {candidates.length === 0 ? (
            <p>{msg("empty", "Chưa gộp tiểu khoản nào vào danh mục này.")}</p>
          ) : (
            <div>
              <label>
                {msg("addAccount", "Tiểu khoản")}
                <select
                  value={String(addAccountId)}
                  onChange={(e) => setAddAccountId(e.target.value)}
                >
                  <option value="">—</option>
                  {candidates.map((a) => (
                    <option key={String(a.id)} value={String(a.id)}>
                      {a.display_name ?? a.external_id ?? String(a.id)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {msg("addRole", "Vai trò")}
                <select value={addRole} onChange={(e) => setAddRole(e.target.value)}>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r === "primary" ? msg("rolePrimary", "Chính") : msg("roleSecondary", "Phụ")}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={addAccountId === "" || saving}
                onClick={() =>
                  setConfirm({
                    type: "add",
                    accountId: addAccountId as string | number,
                    role: addRole,
                  })
                }
              >
                {msg("add", "Gộp")}
              </button>
            </div>
          )}

          <h3>{msg("convertTitle", "Chuyển loại danh mục")}</h3>
          <p>
            {msg("kindLabel", "Loại danh mục")}: {kindLabel(kind)}
          </p>
          {!kindKnown ? (
            <p role="note">
              {msg(
                "unknownKindNote",
                "Không rõ loại danh mục (BE chưa trả kind) — khóa chuyển loại để an toàn.",
              )}
            </p>
          ) : null}
          {count === 0 ? (
            <p role="note">
              {msg("needsBindingHint", "Chuyển sang loại này cần ít nhất 1 tiểu khoản đang gộp.")}
            </p>
          ) : null}
          {count >= 2 ? (
            <p role="note">
              {msg(
                "singleAccountHint",
                "Loại Môi giới chỉ giữ đúng 1 tài khoản — tách bớt trước khi chuyển.",
              )}
            </p>
          ) : null}
          {count > 0 ? (
            <p role="note">
              {msg("requiresEmptyHint", "Về Thủ công phải tách hết tiểu khoản trước.")}
            </p>
          ) : null}
          <div>
            <label>
              {msg("convertKind", "Chuyển loại")}
              <select
                value={convertKind}
                onChange={(e) => setConvertKind(e.target.value as KindTarget)}
              >
                {KIND_TARGETS.map((k) => (
                  <option key={k} value={k} disabled={!targetAllowed(k)}>
                    {kindLabel(k)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!targetAllowed(convertKind) || saving}
              onClick={() => setConfirm({ type: "convert", kind: convertKind })}
            >
              {msg("convert", "Chuyển loại")}
            </button>
          </div>

          {confirm ? (
            <div role="group" aria-label={msg("confirmYes", "Xác nhận")}>
              <p>
                {confirm.type === "add"
                  ? msg("confirmAdd", "Xác nhận gộp tiểu khoản này vào danh mục?")
                  : confirm.type === "remove"
                    ? msg("confirmRemove", "Xác nhận tách tiểu khoản này khỏi danh mục?")
                    : msg("confirmConvert", "Xác nhận chuyển loại danh mục?")}
              </p>
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  confirm.type === "add"
                    ? void doSave(
                        { action: "add", sub_account_id: confirm.accountId, role: confirm.role },
                        "addOk",
                        "Đã gộp tiểu khoản.",
                      )
                    : confirm.type === "remove"
                      ? void doSave(
                          { action: "remove", sub_account_id: confirm.accountId },
                          "removeOk",
                          "Đã tách tiểu khoản.",
                        )
                      : void doSave(
                          { action: "convert", kind: confirm.kind },
                          "convertOk",
                          "Đã chuyển loại danh mục.",
                        )
                }
              >
                {msg("confirmYes", "Xác nhận")}
              </button>
              <button type="button" disabled={saving} onClick={() => setConfirm(null)}>
                {msg("confirmNo", "Hủy")}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default BindingsPanel;
