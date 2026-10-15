import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DNSEConnectionPanel from "../../components/DNSEConnectionPanel.js";
import { ShellPageChrome } from "../../components/ShellPageTemplate.js";
import {
  BrokerConnectForm,
  formatHubMessage,
  type BrokerConnectSchema,
} from "../../components/broker/BrokerConnectForm.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import styles from "../../components/soc/soc.module.css";

/**
 * `/broker` — Broker Hub: 3 tile lane (dnse/ssi/tcbs) + form kết nối động (B2.1/B2.2).
 *
 * - Badge chữ đọc từ `GET /broker/capabilities/` (matrix versioned, BE
 *   `broker/base.py`) — KHÔNG bao giờ suy trạng thái hỗ trợ từ tên provider.
 * - Trạng thái đã nối đọc từ `getBrokerProviders` (adapter do DATA sở hữu —
 *   HUB chỉ tiêu thụ đúng signature, không tự viết adapter).
 * - Lane `dnse` render lại `DNSEConnectionPanel` NGUYÊN VĂN (không sửa 1 dòng).
 * - Chọn lane qua `?provider=` — 1 handler = 1 patch `setSearchParams`
 *   full-state (L-F09). Mọi hằng option ở cấp module (L-F10).
 */

export interface BrokerProviderInfo {
  id: string;
  status: string;
  is_configured: boolean;
  fully_supported: boolean;
}

export interface BrokerProviderCapability {
  read_basic: boolean;
  read_positions: boolean;
  read_orders: boolean;
  trade: boolean;
  otp_required: boolean;
  verified_contract: boolean;
  verified_contract_by?: string;
}

export interface BrokerCapabilitiesResponse {
  version: string;
  providers: Record<string, BrokerProviderCapability>;
}

interface BrokerHubAdapter {
  getBrokerProviders: () => Promise<{ providers: BrokerProviderInfo[] }>;
  coreGet: (path: string) => Promise<BrokerCapabilitiesResponse>;
  getBrokerSchema: (provider: string) => Promise<BrokerConnectSchema>;
}

/** Cấp module (L-F10): key param URL + lane mặc định + adapter cast quy ước. */
const PROVIDER_PARAM_KEY = "provider";
const DEFAULT_LANE = "dnse";
const LEGACY_PANEL_LANE = "dnse";
const CAPABILITIES_PATH = "/broker/capabilities/";
const hubApi = defaultCoreApiAdapter as unknown as BrokerHubAdapter;

function capabilityBadges(
  caps: BrokerCapabilitiesResponse | null,
  providerId: string,
  msg: (key: string, defaultValue: string) => string,
): Array<{ text: string; toneClass: string }> {
  const entry = caps?.providers?.[providerId];
  if (!entry) return [];
  const badges: Array<{ text: string; toneClass: string }> = [];
  badges.push({
    text: entry.verified_contract
      ? msg("brokerHub.hub.badgeVerified", "Đã xác minh đầy đủ")
      : msg("brokerHub.hub.badgePending", "Chờ xác minh"),
    toneClass: entry.verified_contract ? styles.statusBadgeOk : styles.statusBadgeOff,
  });
  if (!entry.trade) {
    badges.push({
      text: msg("brokerHub.hub.badgeReadOnly", "Chỉ đọc"),
      toneClass: styles.statusBadgeInfo,
    });
  }
  if (entry.otp_required) {
    badges.push({
      text: msg("brokerHub.hub.badgeOtp", "Yêu cầu OTP"),
      toneClass: styles.statusBadgeInfo,
    });
  }
  return badges;
}

export function BrokerHubPage({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [providers, setProviders] = useState<BrokerProviderInfo[] | null>(null);
  const [capabilities, setCapabilities] = useState<BrokerCapabilitiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [schema, setSchema] = useState<BrokerConnectSchema | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const msg = useCallback(
    (key: string, defaultValue: string, vars: Record<string, string | number> = {}) =>
      formatHubMessage(t, key, defaultValue, vars),
    [t],
  );

  const selectedProvider = searchParams.get(PROVIDER_PARAM_KEY) ?? DEFAULT_LANE;

  /** Một patch duy nhất ghi TOÀN BỘ state URL (L-F09). */
  const handleSelectProvider = useCallback(
    (lane: string) => {
      setSearchParams({ [PROVIDER_PARAM_KEY]: lane });
    },
    [setSearchParams],
  );

  /**
   * Panel DNSE legacy báo đã nối xong qua `onConnected` — tải lại providers để
   * tile cập nhật. Ổn định identity (panel dùng prop này trong deps callback).
   */
  const handleDnseConnected = useCallback(() => {
    hubApi
      .getBrokerProviders()
      .then((providersRes) => {
        setProviders(providersRes?.providers ?? []);
      })
      .catch(() => {
        // Giữ tile cũ khi refresh thất bại — lỗi đã hiện ở lần tải đầu.
      });
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setLoadError(null);
    Promise.all([hubApi.getBrokerProviders(), hubApi.coreGet(CAPABILITIES_PATH)])
      .then(([providersRes, capabilitiesRes]) => {
        if (!mounted) return;
        setProviders(providersRes?.providers ?? []);
        setCapabilities(capabilitiesRes ?? null);
        setLoadError(null);
      })
      .catch(() => {
        if (!mounted) return;
        setProviders(null);
        setCapabilities(null);
        setLoadError(
          formatHubMessage(t, "brokerHub.hub.errors.loadFail", "Không thể tải danh sách broker."),
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [t]);

  useEffect(() => {
    let mounted = true;
    setSchema(null);
    setSchemaError(null);
    setSchemaLoading(true);
    hubApi
      .getBrokerSchema(selectedProvider)
      .then((next) => {
        if (!mounted) return;
        setSchema(next);
      })
      .catch(() => {
        if (!mounted) return;
        setSchemaError(
          formatHubMessage(t, "brokerHub.hub.errors.schemaFail", "Không thể tải cấu hình kết nối."),
        );
      })
      .finally(() => {
        if (mounted) setSchemaLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [selectedProvider, t]);

  return (
    <ShellPageChrome
      eyebrow={msg("brokerHub.hub.eyebrow", "Broker")}
      title={msg("brokerHub.hub.title", "Broker Hub")}
      className={className}
    >
      <p>{msg("brokerHub.hub.subtitle", "Kết nối và quản lý tài khoản chứng khoán đa-nhà.")}</p>
      {loading ? (
        <p role="status">{msg("brokerHub.hub.loading", "Đang tải danh sách broker…")}</p>
      ) : null}
      {loadError ? (
        <p role="alert" className={styles.bannerError}>
          {loadError}
        </p>
      ) : null}
      {!loading && !loadError ? (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {(providers ?? []).map((lane) => {
            const badges = capabilityBadges(capabilities, lane.id, msg);
            const active = lane.id === selectedProvider;
            return (
              <button
                key={lane.id}
                type="button"
                aria-pressed={active}
                data-testid={`broker-tile-${lane.id}`}
                onClick={() => handleSelectProvider(lane.id)}
                className={styles.sectionCard}
                style={{ textAlign: "left", cursor: "pointer" }}
              >
                <span className={styles.sectionCardTitle}>{lane.id.toUpperCase()}</span>
                <span style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  <span
                    data-testid={`broker-tile-status-${lane.id}`}
                    className={`${styles.statusBadge} ${
                      lane.is_configured ? styles.statusBadgeOk : styles.statusBadgeOff
                    }`}
                  >
                    {lane.is_configured
                      ? msg("brokerHub.hub.tileConfigured", "Đã kết nối")
                      : msg("brokerHub.hub.tileNotConfigured", "Chưa kết nối")}
                  </span>
                  {badges.map((badge) => (
                    <span key={badge.text} className={`${styles.statusBadge} ${badge.toneClass}`}>
                      {badge.text}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      {!loading && !loadError ? (
        <div className={styles.glassPanel} style={{ marginTop: "1rem" }}>
          <BrokerConnectForm
            provider={selectedProvider}
            schema={schema}
            schemaLoading={schemaLoading}
            schemaError={schemaError}
          />
          {selectedProvider === LEGACY_PANEL_LANE ? (
            <DNSEConnectionPanel onConnected={handleDnseConnected} />
          ) : null}
        </div>
      ) : null}
    </ShellPageChrome>
  );
}

export default BrokerHubPage;
