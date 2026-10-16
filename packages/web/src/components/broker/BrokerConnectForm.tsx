import { useCallback, useState } from "react";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import styles from "../soc/soc.module.css";

/**
 * `BrokerConnectForm` — form kết nối broker render ĐỘNG từ
 * `GET /broker/config-schema/<provider>/` (B2.2/AC2).
 *
 * Không hardcode field của bất kỳ lane nào (DNSE `client_id`/`client_secret`,
 * SSI `api_key`/`api_secret`/`private_key`, ... đều tới từ `schema.fields`).
 * Mọi chuỗi VI nằm trong `defaultValue` (prefix `brokerHub.hub.*`, HUB sở hữu).
 */

export interface BrokerSchemaField {
  key: string;
  type: string;
  required: boolean;
  secret?: boolean;
  label_i18n?: string;
  placeholder?: string;
  help_i18n?: string;
}

export interface BrokerConnectSchema {
  provider: string;
  test_connection_kind?: string;
  fields: BrokerSchemaField[];
}

export interface BrokerConnectFormProps {
  provider: string;
  /** Tên hiển thị lane (viết hoa: "DNSE") — id lane giữ nguyên cho API. */
  displayProvider?: string;
  schema: BrokerConnectSchema | null;
  schemaLoading?: boolean;
  schemaError?: string | null;
  onSaved?: () => void;
}

interface BrokerConnectAdapter {
  saveBrokerConfig: (provider: string, data: Record<string, string>) => Promise<unknown>;
  testBrokerConnection: (provider: string) => Promise<{ ok?: boolean; account_count?: number } | null>;
}

/** Adapter cast theo quy ước (`defaultCoreApiAdapter as unknown as {...}`) — HUB chỉ tiêu thụ. */
const brokerConnectApi = defaultCoreApiAdapter as unknown as BrokerConnectAdapter;

interface FormNotice {
  kind: "error" | "success" | "info";
  text: string;
}

/** Bóc `payload.detail` (VI từ BE) trước, fallback chuỗi UI — cùng mẫu `DNSEConnectionPanel`. */
function readBrokerApiError(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const detail = (err as { payload?: { detail?: unknown } }).payload?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return fallback;
}

function inputTypeFor(field: BrokerSchemaField): string {
  if (field.type === "password" || field.secret) return "password";
  return "text";
}

/**
 * Điền `{var}` còn sót sau `t()`.
 *
 * `createTranslator` (`i18n/index.js:47-52`) đã nội suy, nhưng fallback không
 * provider của `useI18n` (`LangContext.js:116-121`) trả `defaultValue` nguyên
 * văn. Helper này là no-op ở app thật và hoàn tất chuỗi ở test trần — hành vi
 * quan sát được giống nhau ở cả hai môi trường.
 */
function fillPlaceholders(template: string, vars: Record<string, string | number>): string {
  let out = template;
  for (const [name, value] of Object.entries(vars)) {
    out = out.split(`{${name}}`).join(String(value));
  }
  return out;
}

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * Dịch + điền `{var}` còn sót — dùng chung cho mọi bề mặt Broker Hub để hành vi
 * giống nhau ở app thật (translator đã nội suy) và test trần (fallback giữ
 * nguyên `defaultValue`).
 */
export function formatHubMessage(
  t: TranslateFn,
  key: string,
  defaultValue: string,
  vars: Record<string, string | number> = {},
): string {
  return fillPlaceholders(t(key, { defaultValue, ...vars }), vars);
}

export function BrokerConnectForm({
  provider,
  displayProvider,
  schema,
  schemaLoading = false,
  schemaError = null,
  onSaved,
}: BrokerConnectFormProps) {
  const providerLabel = displayProvider ?? provider;
  const { t } = useI18n();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [notice, setNotice] = useState<FormNotice | null>(null);

  const handleFieldChange = useCallback((key: string, next: string) => {
    setValues((prev) => ({ ...prev, [key]: next }));
  }, []);

  const missingRequiredKey = useCallback((): string | null => {
    if (!schema) return null;
    const missing = schema.fields.find(
      (field) => field.required && !(values[field.key] ?? "").trim(),
    );
    return missing ? missing.key : null;
  }, [schema, values]);

  const translate = useCallback(
    (key: string, defaultValue: string, vars: Record<string, string | number> = {}) =>
      formatHubMessage(t, key, defaultValue, vars),
    [t],
  );

  const handleSave = useCallback(async () => {
    const missing = missingRequiredKey();
    if (missing) {
      setNotice({
        kind: "error",
        text: translate("brokerHub.hub.errors.fieldRequired", "Vui lòng nhập {field}.", {
          field: missing,
        }),
      });
      return;
    }
    if (!schema) return;
    const payload: Record<string, string> = {};
    for (const field of schema.fields) {
      payload[field.key] = values[field.key] ?? "";
    }
    setBusy("save");
    setNotice(null);
    try {
      await brokerConnectApi.saveBrokerConfig(provider, payload);
      // conn-hardening (F-FE-01): secret khong nam lai trong state/DOM sau luu.
      setValues({});
      setNotice({
        kind: "success",
        text: translate("brokerHub.hub.saveOk", "Đã lưu kết nối {provider}.", { provider }),
      });
      if (onSaved) onSaved();
    } catch (err) {
      setNotice({
        kind: "error",
        text: readBrokerApiError(
          err,
          translate("brokerHub.hub.errors.saveFail", "Lưu kết nối thất bại."),
        ),
      });
    } finally {
      setBusy(null);
    }
  }, [missingRequiredKey, onSaved, provider, schema, translate, values]);

  const handleTest = useCallback(async () => {
    const missing = missingRequiredKey();
    if (missing) {
      setNotice({
        kind: "error",
        text: translate("brokerHub.hub.errors.fieldRequired", "Vui lòng nhập {field}.", {
          field: missing,
        }),
      });
      return;
    }
    setBusy("test");
    setNotice(null);
    try {
      const res = await brokerConnectApi.testBrokerConnection(provider);
      if (res && res.ok) {
        const count = typeof res.account_count === "number" ? res.account_count : 0;
        setNotice({
          kind: "success",
          text: translate("brokerHub.hub.testOk", "Kiểm tra kết nối thành công: {count} tài khoản.", {
            count,
          }),
        });
      } else {
        setNotice({
          kind: "error",
          text: translate("brokerHub.hub.errors.testFail", "Kiểm tra kết nối thất bại."),
        });
      }
    } catch (err) {
      setNotice({
        kind: "error",
        text: readBrokerApiError(
          err,
          translate("brokerHub.hub.errors.testFail", "Kiểm tra kết nối thất bại."),
        ),
      });
    } finally {
      setBusy(null);
    }
  }, [missingRequiredKey, provider, translate]);

  if (schemaLoading) {
    return (
      <p role="status">
        {t("brokerHub.hub.schemaLoading", { defaultValue: "Đang tải cấu hình kết nối…" })}
      </p>
    );
  }

  if (schemaError || !schema) {
    return (
      <p role="alert" className={styles.bannerError}>
        {schemaError ??
          t("brokerHub.hub.errors.schemaFail", {
            defaultValue: "Không thể tải cấu hình kết nối.",
          })}
      </p>
    );
  }

  return (
    <section
      aria-label={translate("brokerHub.hub.connectTitle", "Kết nối {provider}.", {
        provider: providerLabel,
      })}
      className={styles.brokerForm}
    >
      <h3 className={styles.sectionCardTitle}>
        {translate("brokerHub.hub.connectTitle", "Kết nối {provider}.", {
          provider: providerLabel,
        })}
      </h3>
      {schema.fields.map((field) => {
        const fieldId = `broker-connect-${provider}-${field.key}`;
        return (
          <label key={field.key} className={styles.brokerFormField} htmlFor={fieldId}>
            <span>
              {t(field.label_i18n ?? `brokerHub.hub.field.${field.key}`, {
                defaultValue: field.placeholder ?? field.key,
              })}
              {field.required ? " *" : ""}
            </span>
            <input
              id={fieldId}
              type={inputTypeFor(field)}
              name={field.key}
              value={values[field.key] ?? ""}
              placeholder={field.placeholder ?? field.key}
              required={field.required}
              autoComplete={field.secret ? "new-password" : "off"}
              spellCheck={false}
              className={styles.fieldInput}
              onChange={(event) => handleFieldChange(field.key, event.target.value)}
            />
          </label>
        );
      })}
      {notice ? (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={notice.kind === "error" ? styles.bannerError : styles.bannerNotice}
        >
          {notice.text}
        </p>
      ) : null}
      {!notice &&
      schema.fields.some((field) => (values[field.key] ?? "").trim() !== "") ? (
        <p role="note">
          {translate(
            "brokerHub.hub.testNeedsSave",
            "Kiểm tra dùng cấu hình đã lưu — bấm Lưu kết nối trước.",
          )}
        </p>
      ) : null}
      <div className={styles.brokerFormActions}>
        <button
          type="button"
          onClick={handleSave}
          disabled={busy !== null}
          className={`${styles.actionBtn} ${styles.actionBtnPrimary} ${styles.actionBtnBlock}`}
        >
          {busy === "save"
            ? t("brokerHub.hub.saving", { defaultValue: "Đang lưu…" })
            : t("brokerHub.hub.save", { defaultValue: "Lưu kết nối" })}
        </button>
        <button
          type="button"
          onClick={handleTest}
          disabled={busy !== null}
          className={`${styles.actionBtn} ${styles.actionBtnSecondary} ${styles.actionBtnBlock}`}
        >
          {busy === "test"
            ? t("brokerHub.hub.testing", { defaultValue: "Đang kiểm tra…" })
            : t("brokerHub.hub.testConnection", { defaultValue: "Kiểm tra kết nối" })}
        </button>
      </div>
    </section>
  );
}

export default BrokerConnectForm;
