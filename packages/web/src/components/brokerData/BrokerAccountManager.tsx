/**
 * mbw2-data B2.3 — Account Manager: 4 tab Vị thế / Sổ lệnh / Khớp lệnh / Số dư.
 *
 * AC3: badge mọi dòng theo QUY TẮC JOIN §2 — provider = provider của account
 * trong URL (đọc 1 lần từ `getBrokerAccount`), KHÔNG suy từ dòng dữ liệu.
 * Account chưa liên kết config (`broker_config_id` null) ⇒ badge `unlinked`
 * và 0 request đọc positions/balance/orders.
 *
 * Tab Khớp lệnh = orders lọc status client-side (`isMatchedOrder`), ghi rõ
 * giới hạn: không có endpoint fills riêng.
 *
 * Luật sắt: 1 handler = 1 patch `setSearchParams` full-state (L-F09);
 * spec hook cấp module (L-F10).
 */
import { useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext";
import { useUrlState, type UrlStateCodec } from "../../hooks/useUrlState";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { ProviderBadge, SourceBadge, filterMatchedOrders } from "./sourceBadge";
import "./brokerData.css";

export interface BrokerAccount {
  id: string | number;
  provider?: string | null;
  external_id?: string | null;
  account_number?: string | null;
  display_name?: string | null;
  broker_config_id?: string | number | null;
  last_sync_at?: string | null;
}

export interface BrokerPosition {
  symbol?: string;
  quantity?: number | string;
  avg_price?: number | string | null;
  market_price?: number | string | null;
}

export interface BrokerBalance {
  cash?: number | string | null;
  stock_value?: number | string | null;
  debt?: number | string | null;
  net_equity?: number | string | null;
  buying_power?: number | string | null;
}

export interface BrokerOrder {
  order_id?: string;
  symbol?: string;
  side?: string;
  price?: number | string | null;
  quantity?: number | string | null;
  status?: string;
  placed_at?: string | null;
}

export interface BrokerAccountAdapter {
  getBrokerAccount: (accountId: string | number) => Promise<BrokerAccount>;
  getAccountPositions: (accountId: string | number) => Promise<BrokerPosition[]>;
  getAccountBalance: (accountId: string | number) => Promise<BrokerBalance>;
  getAccountOrders: (accountId: string | number) => Promise<BrokerOrder[]>;
}

type TabKey = "positions" | "orders" | "matched" | "balance";

/** Cấp module (L-F10): spec + defaults ổn định, không literal trong render. */
const TAB_KEYS: readonly TabKey[] = ["positions", "orders", "matched", "balance"];
const tabCodec: UrlStateCodec<TabKey> = {
  parse: (raw) => ((raw != null && (TAB_KEYS as readonly string[]).includes(raw) ? raw : undefined) as TabKey | undefined),
  serialize: (v) => (v === "positions" ? undefined : v),
};
const TAB_SPEC = { tab: tabCodec };
const TAB_DEFAULTS = { tab: "positions" as TabKey };

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "unlinked"; account: BrokerAccount }
  | {
      phase: "ready";
      account: BrokerAccount;
      positions: BrokerPosition[];
      balance: BrokerBalance;
      orders: BrokerOrder[];
    };

function fmtNum(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString("vi-VN");
}

export function BrokerAccountManager({
  accountId,
  adapter,
}: {
  accountId: string | number;
  adapter?: BrokerAccountAdapter;
}) {
  const { t } = useI18n();
  const api = (adapter ?? defaultCoreApiAdapter) as unknown as BrokerAccountAdapter;
  const [{ tab }, setUrlState] = useUrlState(TAB_SPEC, TAB_DEFAULTS);
  const [state, setState] = useState<LoadState>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ phase: "loading" });
    api
      .getBrokerAccount(accountId)
      .then((account) => {
        if (cancelled) return null;
        if (!account) throw new Error("not_found");
        // Quy tắc join §2: chưa liên kết ⇒ DỪNG, không gọi endpoint đọc nào.
        if (account.broker_config_id === null || account.broker_config_id === undefined) {
          setState({ phase: "unlinked", account });
          return null;
        }
        return Promise.all([
          api.getAccountPositions(accountId),
          api.getAccountBalance(accountId),
          api.getAccountOrders(accountId),
        ]).then(([positions, balance, orders]) => {
          if (!cancelled) setState({ phase: "ready", account, positions, balance, orders });
        });
      })
      .catch((err) => {
        if (!cancelled) {
          const code = (err as { code?: string })?.code;
          const message =
            code === "sub_account_not_found" || (err as Error)?.message === "not_found"
              ? t("brokerHub.data.account.notFound", { defaultValue: "Tiểu khoản không tồn tại." })
              : t("brokerHub.data.account.loadError", { defaultValue: "Không tải được tài khoản môi giới." });
          setState({ phase: "error", message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, api, t]);

  // L-F09: 1 handler = 1 patch full-state (không gọi 2 setter cùng tick).
  const selectTab = (key: TabKey) => setUrlState({ tab: key });

  const tabLabel = (key: TabKey) =>
    key === "positions"
      ? t("brokerHub.data.tabs.positions", { defaultValue: "Vị thế" })
      : key === "orders"
        ? t("brokerHub.data.tabs.orders", { defaultValue: "Sổ lệnh" })
        : key === "matched"
          ? t("brokerHub.data.tabs.matched", { defaultValue: "Khớp lệnh" })
          : t("brokerHub.data.tabs.balance", { defaultValue: "Số dư" });

  if (state.phase === "loading") {
    return <p role="status">{t("brokerHub.data.account.title", { defaultValue: "Tài khoản" })}…</p>;
  }
  if (state.phase === "error") {
    return <p role="alert">{state.message}</p>;
  }

  const { account } = state;
  const unlinked = state.phase === "unlinked";
  const provider = account.provider ?? null;
  const sideLabel = (side: unknown) => {
    const s = String(side ?? "").toUpperCase();
    if (s === "BUY") return t("brokerHub.data.orders.sideBuy", { defaultValue: "Mua" });
    if (s === "SELL") return t("brokerHub.data.orders.sideSell", { defaultValue: "Bán" });
    return String(side ?? "—");
  };

  const orders = state.phase === "ready" ? state.orders : [];
  const matched = filterMatchedOrders(orders);

  const renderOrderTable = (rows: BrokerOrder[]) => (
    <table className="bdata-table">
      <thead>
        <tr>
          <th scope="col">{t("brokerHub.data.orders.orderId", { defaultValue: "Mã lệnh" })}</th>
          <th scope="col">{t("brokerHub.data.orders.symbol", { defaultValue: "Mã" })}</th>
          <th scope="col">{t("brokerHub.data.orders.side", { defaultValue: "Hướng" })}</th>
          <th scope="col">{t("brokerHub.data.orders.price", { defaultValue: "Giá" })}</th>
          <th scope="col">{t("brokerHub.data.orders.quantity", { defaultValue: "KL" })}</th>
          <th scope="col">{t("brokerHub.data.orders.status", { defaultValue: "Trạng thái" })}</th>
          <th scope="col">{t("brokerHub.data.orders.placedAt", { defaultValue: "Giờ đặt" })}</th>
          <th scope="col">{t("brokerHub.data.account.title", { defaultValue: "Tài khoản" })}</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={8}>{t("brokerHub.data.orders.empty", { defaultValue: "Chưa có lệnh nào." })}</td>
          </tr>
        )}
        {rows.map((o) => (
          <tr key={String(o.order_id ?? `${o.symbol}-${o.placed_at}`)}>
            <td>{o.order_id ?? "—"}</td>
            <td>{o.symbol ?? "—"}</td>
            <td>{sideLabel(o.side)}</td>
            <td>{fmtNum(o.price)}</td>
            <td>{fmtNum(o.quantity)}</td>
            <td>{o.status ?? "—"}</td>
            <td>{o.placed_at ?? "—"}</td>
            <td>
              <ProviderBadge provider={provider} unlinked={unlinked} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="bdata-wrap">
      <div className="bdata-head">
        <span className="bdata-title">
          {account.display_name ?? account.account_number ?? `#${String(account.id)}`}
        </span>
        {unlinked ? <SourceBadge source="unlinked" /> : <ProviderBadge provider={provider} />}
      </div>

      <div className="bdata-tabs" role="tablist" aria-label={t("brokerHub.data.title", { defaultValue: "Dữ liệu môi giới" })}>
        {TAB_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className="bdata-tab"
            onClick={() => selectTab(key)}
          >
            {tabLabel(key)}
          </button>
        ))}
      </div>

      {unlinked && (
        <p className="bdata-note" role="note">
          {t("brokerHub.data.account.unlinkedNote", {
            defaultValue: "Tiểu khoản chưa liên kết cấu hình broker nên không đọc được vị thế, sổ lệnh và số dư.",
          })}
        </p>
      )}

      {!unlinked && state.phase === "ready" && (
        <>
          {tab === "positions" && (
            <div role="tabpanel">
              <table className="bdata-table">
                <thead>
                  <tr>
                    <th scope="col">{t("brokerHub.data.positions.symbol", { defaultValue: "Mã" })}</th>
                    <th scope="col">{t("brokerHub.data.positions.quantity", { defaultValue: "KL" })}</th>
                    <th scope="col">{t("brokerHub.data.positions.avgPrice", { defaultValue: "Giá vốn" })}</th>
                    <th scope="col">{t("brokerHub.data.positions.marketPrice", { defaultValue: "Giá hiện tại" })}</th>
                    <th scope="col">{t("brokerHub.data.account.title", { defaultValue: "Tài khoản" })}</th>
                  </tr>
                </thead>
                <tbody>
                  {state.positions.length === 0 && (
                    <tr>
                      <td colSpan={5}>{t("brokerHub.data.positions.empty", { defaultValue: "Chưa có vị thế nào." })}</td>
                    </tr>
                  )}
                  {state.positions.map((p) => (
                    <tr key={String(p.symbol)}>
                      <td>{p.symbol ?? "—"}</td>
                      <td>{fmtNum(p.quantity)}</td>
                      <td>{fmtNum(p.avg_price)}</td>
                      <td>{fmtNum(p.market_price)}</td>
                      <td>
                        <ProviderBadge provider={provider} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "orders" && <div role="tabpanel">{renderOrderTable(orders)}</div>}

          {tab === "matched" && (
            <div role="tabpanel">
              <p className="bdata-note" role="note">
                {t("brokerHub.data.matched.note", {
                  defaultValue: "Lọc khớp lệnh phía client từ sổ lệnh (không có endpoint fills riêng).",
                })}
              </p>
              {renderOrderTable(matched)}
            </div>
          )}

          {tab === "balance" && (
            <div role="tabpanel">
              <dl className="bdata-balance">
                <div>
                  <dt>{t("brokerHub.data.balance.cash", { defaultValue: "Tiền mặt" })}</dt>
                  <dd>{fmtNum(state.balance.cash)}</dd>
                </div>
                <div>
                  <dt>{t("brokerHub.data.balance.stockValue", { defaultValue: "Giá trị cổ phiếu" })}</dt>
                  <dd>{fmtNum(state.balance.stock_value)}</dd>
                </div>
                <div>
                  <dt>{t("brokerHub.data.balance.debt", { defaultValue: "Nợ" })}</dt>
                  <dd>{fmtNum(state.balance.debt)}</dd>
                </div>
                <div>
                  <dt>{t("brokerHub.data.balance.netEquity", { defaultValue: "Tài sản ròng" })}</dt>
                  <dd>{fmtNum(state.balance.net_equity)}</dd>
                </div>
                <div>
                  <dt>{t("brokerHub.data.balance.buyingPower", { defaultValue: "Sức mua" })}</dt>
                  <dd>{fmtNum(state.balance.buying_power)}</dd>
                </div>
              </dl>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default BrokerAccountManager;
