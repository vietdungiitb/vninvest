/**
 * mbw3 B3.3-FE — ScopedWatchlist: watchlist đúng scope + derived tách riêng
 * (ADR-007, contract §2 đóng băng).
 *
 * - Manual: `getWatchlistsScoped({provider, brokerAccountId})` (BE filter
 *   `?provider=&broker_account=`); chỉ hiện đúng scope (AC5).
 * - Derived: `getDerivedWatchlist(accountId)` — FE-compute từ positions,
 *   read-only; section riêng, nhãn "Đang nắm giữ @ provider/tiểu khoản",
 *   empty-copy khác manual (AC5).
 * - Quy tắc hiển thị §2: 2 khu vực riêng, badge nguồn mọi dòng.
 *
 * Props-driven (cha sở hữu filter/URL); component không tự đọc URL nên mount
 * ở Watchlist hay Broker đều được. Mount đề xuất (ngoài phạm vi file slice
 * này — xem evidence): khu vực riêng trong trang Watchlist.
 *
 * Luật sắt: hằng/spec cấp module (L-F10); mọi chuỗi `brokerWave3.watchlist.*`.
 */
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { ProviderBadge, SourceBadge } from "./sourceBadge";
import "./brokerData.css";

export interface ScopedWatchlistItem {
  id?: string | number;
  name?: string | null;
  source?: string | null;
  provider?: string | null;
  broker_account?: string | number | null;
}

export interface DerivedHolding {
  symbol?: string | null;
  quantity?: number | string | null;
}

export interface DerivedWatchlist {
  account?: {
    id?: string | number;
    provider?: string | null;
    display_name?: string | null;
    account_number?: string | null;
  } | null;
  items?: DerivedHolding[];
}

export interface ScopedWatchlistAdapter {
  getWatchlistsScoped: (scope: {
    provider?: string | null;
    brokerAccountId?: string | number | null;
  }) => Promise<unknown>;
  getDerivedWatchlist: (accountId: string | number) => Promise<unknown>;
}

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

function asDerived(payload: unknown): DerivedWatchlist {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const obj = payload as Record<string, unknown>;
    const items = Array.isArray(obj.items)
      ? (obj.items as DerivedHolding[])
      : asList(obj.positions) as unknown as DerivedHolding[];
    return { account: (obj.account as DerivedWatchlist["account"]) ?? null, items };
  }
  return { account: null, items: [] };
}

const scopedApi = defaultCoreApiAdapter as unknown as ScopedWatchlistAdapter;

function fmtQty(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString("vi-VN");
}

export function ScopedWatchlist({
  provider,
  brokerAccountId,
  adapter,
}: {
  provider?: string | null;
  brokerAccountId?: string | number | null;
  adapter?: ScopedWatchlistAdapter;
}) {
  const { t } = useI18n();
  const api = (adapter ?? scopedApi) as ScopedWatchlistAdapter;
  const msg = useCallback(
    (key: string, defaultValue: string, vars: Record<string, string | number> = {}) =>
      t(`brokerWave3.watchlist.${key}`, { defaultValue, ...vars }),
    [t],
  );

  const [lists, setLists] = useState<ScopedWatchlistItem[]>([]);
  const [derived, setDerived] = useState<DerivedWatchlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const scope = {
      provider: provider ?? null,
      brokerAccountId: brokerAccountId ?? null,
    };
    const manualP = api.getWatchlistsScoped(scope).then(asList);
    const derivedP =
      brokerAccountId !== null && brokerAccountId !== undefined && brokerAccountId !== ""
        ? api.getDerivedWatchlist(brokerAccountId).then(asDerived)
        : Promise.resolve(null);
    Promise.all([manualP, derivedP])
      .then(([m, d]) => {
        if (cancelled) return;
        setLists(m as unknown as ScopedWatchlistItem[]);
        setDerived(d);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError(msg("loadError", "Không tải được danh mục theo dõi."));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api, provider, brokerAccountId, msg]);

  if (loading) {
    return <p role="status">{msg("loading", "Đang tải danh mục theo dõi…")}</p>;
  }
  if (error) {
    return <p role="alert">{error}</p>;
  }

  const showDerived = derived !== null;
  const derivedAccount = derived?.account ?? null;
  const derivedItems = derived?.items ?? [];

  return (
    <div className="bdata-wrap">
      <div className="bdata-head">
        <span className="bdata-title">{msg("title", "Danh mục theo dõi theo phạm vi")}</span>
      </div>
      <p className="bdata-note" role="note">
        {msg(
          "subtitle",
          "Lọc theo nhà môi giới / tiểu khoản. Danh sách suy ra tách riêng khỏi danh sách thủ công.",
        )}
      </p>

      <section aria-label={msg("manualTitle", "Danh sách thủ công")}>
        <h3>{msg("manualTitle", "Danh sách thủ công")}</h3>
        {lists.length === 0 ? (
          <p>{msg("manualEmpty", "Chưa có danh sách theo dõi thủ công nào trong phạm vi này.")}</p>
        ) : (
          <ul>
            {lists.map((w) => (
              <li key={String(w.id ?? w.name)}>
                {w.name ?? "—"}
                <SourceBadge source={w.source ?? "manual"} />
                <ProviderBadge
                  provider={w.provider ?? provider ?? null}
                  unlinked={!w.provider && !provider}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {showDerived ? (
        <section
          aria-label={msg("derivedTitle", "Đang nắm giữ @ {provider} / {account}", {
            provider: String(derivedAccount?.provider ?? provider ?? "").toUpperCase(),
            account: String(
              derivedAccount?.display_name ?? derivedAccount?.account_number ?? brokerAccountId ?? "",
            ),
          })}
        >
          <h3>
            {msg("derivedTitle", "Đang nắm giữ @ {provider} / {account}", {
              provider: String(derivedAccount?.provider ?? provider ?? "").toUpperCase(),
              account: String(
                derivedAccount?.display_name ??
                  derivedAccount?.account_number ??
                  brokerAccountId ??
                  "",
              ),
            })}
          </h3>
          {derivedItems.length === 0 ? (
            <p>{msg("derivedEmpty", "Tiểu khoản chưa nắm giữ mã nào.")}</p>
          ) : (
            <table className="bdata-table">
              <thead>
                <tr>
                  {/* Tái dùng key DATA (khớp nghĩa — ngoại lệ cho phép): không thêm key mới. */}
                  <th scope="col">{t("brokerHub.data.positions.symbol", { defaultValue: "Mã" })}</th>
                  <th scope="col">
                    {t("brokerHub.data.positions.quantity", { defaultValue: "KL" })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {derivedItems.map((d, i) => (
                  <tr key={`${String(d.symbol ?? i)}-${i}`}>
                    <td>{d.symbol ?? "—"}</td>
                    <td>{fmtQty(d.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}
    </div>
  );
}

export default ScopedWatchlist;
