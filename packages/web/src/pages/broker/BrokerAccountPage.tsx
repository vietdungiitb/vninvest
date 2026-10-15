import { useCallback, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ShellPageChrome } from "../../components/ShellPageTemplate.js";
import { formatHubMessage } from "../../components/broker/BrokerConnectForm.js";
import {
  BrokerAccountManager,
  type BrokerAccountAdapter,
} from "../../components/brokerData/BrokerAccountManager.js";
import {
  BrokerSyncCenter,
  type BrokerSyncAdapter,
} from "../../components/brokerData/BrokerSyncCenter.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";

/**
 * `/broker/accounts/:accountId` — trang chi tiết tiểu khoản (follow-up mount).
 *
 * - Render `BrokerAccountManager` (4 tab Vị thế/Sổ lệnh/Khớp lệnh/Số dư) +
 *   `BrokerSyncCenter` (DATA viết, HUB chỉ mount — 0 dòng sửa file DATA).
 * - Dùng đúng adapter DATA qua `defaultCoreApiAdapter` (cast quy ước, cùng họ
 *   `BrokerHubPage`), KHÔNG gọi coreGet trực tiếp.
 * - Badge provider join theo §2 PLAN_WAVE2: provider lấy từ account trong URL
 *   (thực thi BÊN TRONG component DATA); page chỉ truyền `accountId` xuyên suốt.
 * - Thiếu `:accountId` ⇒ fail-closed (alert hub.*, 0 request adapter).
 */

/** Cấp module (L-F10): adapter cast quy ước + type giao nhau DATA. */
type BrokerAccountRouteAdapter = BrokerAccountAdapter & BrokerSyncAdapter;

const accountApi = defaultCoreApiAdapter as unknown as BrokerAccountRouteAdapter;

export function BrokerAccountPage({
  className = "",
  pollIntervalMs,
}: {
  className?: string;
  /** Passthrough xuống SyncCenter (test cần poll nhanh; app dùng default 1500ms). */
  pollIntervalMs?: number;
}) {
  const { t } = useI18n();
  const { accountId } = useParams();

  const msg = useCallback(
    (key: string, defaultValue: string, vars: Record<string, string | number> = {}) =>
      formatHubMessage(t, key, defaultValue, vars),
    [t],
  );

  const chrome = (body: ReactNode) => (
    <ShellPageChrome
      eyebrow={msg("brokerHub.hub.accountEyebrow", "Tài khoản môi giới")}
      title={msg("brokerHub.hub.accountTitle", "Chi tiết tài khoản")}
      className={className}
    >
      {body}
    </ShellPageChrome>
  );

  if (!accountId) {
    return chrome(
      <p role="alert">{msg("brokerHub.hub.errors.accountMissing", "Thiếu mã tài khoản trong URL.")}</p>,
    );
  }

  return chrome(
    <>
      <p>
        <Link to="/broker">← {msg("brokerHub.hub.backToHub", "Về Broker Hub")}</Link>
      </p>
      <BrokerAccountManager accountId={accountId} adapter={accountApi} />
      <BrokerSyncCenter accountId={accountId} adapter={accountApi} pollIntervalMs={pollIntervalMs} />
    </>,
  );
}

export default BrokerAccountPage;
