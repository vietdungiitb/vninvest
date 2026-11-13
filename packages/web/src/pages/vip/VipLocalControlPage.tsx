import styles from "../../components/ShellPageTemplate.module.css";
import {
  startTransition,
  useEffect,
  useRef,
  useState,
} from "react";

import { createVipAppControlClient } from "../../adapters/vip-app/vipAppAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import {
  ShellField,
  ShellPageChrome,
  ShellPanel,
  ShellSelectField,
  renderShellMetric,
} from "../../components/ShellPageTemplate.js";
import { loadShellBootstrap } from "../../context/bootstrapClient.js";

type Translate = (key: string, opts?: Record<string, unknown>) => string;

const ROLE_KEYS = Object.freeze(["vip_viewer", "vip_operator", "vip_admin", "vip_superuser"]);

function roleLabel(roleKey: string, tr: Translate): string {
  const key = `vipLocalControl.role_${roleKey}`;
  const fallback = roleKey === "vip_viewer" ? tr(key, { defaultValue: "Người xem VIP" })
    : roleKey === "vip_operator" ? tr(key, { defaultValue: "Điều phối viên VIP" })
    : roleKey === "vip_admin" ? tr(key, { defaultValue: "Quản trị viên VIP" })
    : roleKey === "vip_superuser" ? tr(key, { defaultValue: "Siêu quản trị VIP" })
    : roleKey;
  return fallback;
}

interface Credentials {
  username: string;
  password: string;
}

interface UserDraft {
  username: string;
  email: string;
  roleKey: string;
  password: string;
}

interface HealthInfo {
  service?: string;
  ok?: boolean;
}

interface Capabilities {
  abilities?: string[];
  navigation?: {
    visible_routes?: string[];
  };
}

interface SessionInfo {
  principal?: {
    username?: string;
  };
  session_id?: string;
}

interface User {
  user_id: string;
  username: string;
  email?: string;
  role_keys?: string[];
}

interface AuditEntry {
  audit_id: string;
  action: string;
  created_at: string;
  actor_username?: string;
}

interface ControlSnapshot {
  health: HealthInfo | null;
  capabilities: Capabilities | null;
  session: SessionInfo | null;
  users: User[];
  auditLogs: AuditEntry[];
}

interface ViewState extends ControlSnapshot {
  loading: boolean;
  working: boolean;
  error: string;
  notice: string;
}

type BootstrapLoader = (options: { adapter: string; env: Record<string, unknown>; fetchImpl?: unknown }) => Promise<{
  health: HealthInfo;
  capabilities: Capabilities;
  session: SessionInfo;
}>;

interface ControlClient {
  login: (params: { username: string; password: string }) => Promise<{ session: SessionInfo }>;
  logout: () => Promise<unknown>;
  resetSession: () => Promise<{ session: SessionInfo }>;
  listUsers: () => Promise<{ users: User[] }>;
  upsertUser: (params: {
    username: string;
    email?: string;
    role_keys?: string[];
    password?: string;
  }) => Promise<{ user: User; created: boolean }>;
  listAuditLogs: (params: { limit: number }) => Promise<{ audit_logs: AuditEntry[] }>;
}

interface VipLocalControlPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: unknown;
  controlClient?: ControlClient | null;
  bootstrapLoader?: BootstrapLoader;
  auditLimit?: number;
  autoLoad?: boolean;
  initialCredentials?: Partial<Credentials>;
  initialUserDraft?: Partial<UserDraft>;
  initialSnapshot?: Partial<ControlSnapshot> | null;
}

function createCredentials(initialCredentials: Partial<Credentials> = {}): Credentials {
  return {
    username: initialCredentials.username ?? "vip-local-admin",
    password: initialCredentials.password ?? "vip-demo-pass",
  };
}

function createUserDraft(initialUserDraft: Partial<UserDraft> = {}): UserDraft {
  return {
    username: initialUserDraft.username ?? "",
    email: initialUserDraft.email ?? "",
    roleKey: initialUserDraft.roleKey ?? "vip_operator",
    password: initialUserDraft.password ?? "",
  };
}

function createEmptySnapshot(): ControlSnapshot {
  return {
    health: null,
    capabilities: null,
    session: null,
    users: [],
    auditLogs: [],
  };
}

function createInitialViewState(initialSnapshot: Partial<ControlSnapshot> | null = null): ViewState {
  if (!initialSnapshot) {
    return {
      loading: true,
      working: false,
      error: "",
      notice: "",
      ...createEmptySnapshot(),
    };
  }

  return {
    loading: false,
    working: false,
    error: "",
    notice: "",
    ...createEmptySnapshot(),
    ...initialSnapshot,
    users: Array.isArray(initialSnapshot.users) ? initialSnapshot.users : [],
    auditLogs: Array.isArray(initialSnapshot.auditLogs) ? initialSnapshot.auditLogs : [],
  };
}

function normalizeErrorMessage(error: unknown, tr: Translate): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return tr("vipLocalControl.genericError", { defaultValue: "Không thể hoàn tất thao tác điều khiển VIP cục bộ." });
}

function formatTimestamp(value: string | null | undefined, tr: Translate): string {
  if (!value) {
    return tr("vipLocalControl.noTimestamp", { defaultValue: "Chưa có mốc thời gian" });
  }

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(timestamp);
}

function getRoleLabel(roleKey: string, tr: Translate): string {
  return roleLabel(roleKey, tr);
}

async function loadControlSnapshot({
  bootstrapLoader,
  controlClient,
  env,
  fetchImpl,
  auditLimit,
}: {
  bootstrapLoader: BootstrapLoader;
  controlClient: ControlClient;
  env: Record<string, unknown>;
  fetchImpl?: unknown;
  auditLimit: number;
}): Promise<ControlSnapshot> {
  const [bootstrap, usersPayload, auditPayload] = await Promise.all([
    bootstrapLoader({ adapter: "vip-app", env, fetchImpl }),
    controlClient.listUsers(),
    controlClient.listAuditLogs({ limit: auditLimit }),
  ]);

  return {
    health: bootstrap.health || null,
    capabilities: bootstrap.capabilities || null,
    session: bootstrap.session || null,
    users: Array.isArray(usersPayload.users) ? usersPayload.users : [],
    auditLogs: Array.isArray(auditPayload.audit_logs) ? auditPayload.audit_logs : [],
  };
}

function renderUserItem(user: User, tr: Translate) {
  const roleKeys = Array.isArray(user.role_keys) ? user.role_keys : [];
  const roleText = roleKeys.length > 0 ? roleKeys.map((key) => getRoleLabel(key, tr)).join(" • ") : tr("vipLocalControl.noRole", { defaultValue: "Chưa gán vai trò" });

  return (
    <li className={`${styles.listItem}`} key={`${user.user_id}:${user.username}`}>
      <div className={`${styles.listItemHeader}`}>
        <h3 className={`${styles.itemTitle}`}>{user.username}</h3>
        <span className={`${styles.pill}`}>{roleText}</span>
      </div>
      <p className={`${styles.itemMeta}`}>{user.email || tr("vipLocalControl.noEmail", { defaultValue: "Chưa có email" })} · {tr("vipLocalControl.userIdPrefix", { defaultValue: "Mã người dùng" })} {user.user_id}</p>
    </li>
  );
}

function renderAuditItem(entry: AuditEntry, tr: Translate) {
  return (
    <li className={`${styles.listItem}`} key={`${entry.audit_id}:${entry.action}`}>
      <div className={`${styles.listItemHeader}`}>
        <h3 className={`${styles.itemTitle}`}>{entry.action}</h3>
        <span className={`${styles.pill}`}>{formatTimestamp(entry.created_at, tr)}</span>
      </div>
      <p className={`${styles.itemMeta}`}>{tr("vipLocalControl.actor", { defaultValue: "Tác nhân" })}: {entry.actor_username || "system"}</p>
    </li>
  );
}

export function VipLocalControlPage({
  env = {},
  fetchImpl,
  controlClient = null,
  bootstrapLoader = loadShellBootstrap,
  auditLimit = 8,
  autoLoad = true,
  initialCredentials = {},
  initialUserDraft = {},
  initialSnapshot = null,
}: VipLocalControlPageProps) {
  const { t } = useI18n();
  const clientRef = useRef<ControlClient | null>(controlClient);
  const envRef = useRef(env);
  const fetchImplRef = useRef(fetchImpl);
  const bootstrapLoaderRef = useRef<BootstrapLoader>(bootstrapLoader);

  envRef.current = env;
  fetchImplRef.current = fetchImpl;
  bootstrapLoaderRef.current = bootstrapLoader;

  if (controlClient && clientRef.current !== controlClient) {
    clientRef.current = controlClient;
  }

  if (clientRef.current === null) {
    clientRef.current = createVipAppControlClient({ env, fetchImpl }) as ControlClient;
  }

  const controlPlaneClient = clientRef.current;
  const [credentials, setCredentials] = useState<Credentials>(() => createCredentials(initialCredentials));
  const [userDraft, setUserDraft] = useState<UserDraft>(() => createUserDraft(initialUserDraft));
  const [viewState, setViewState] = useState<ViewState>(() => createInitialViewState(initialSnapshot));

  async function refreshSnapshot(notice = "") {
    const snapshot = await loadControlSnapshot({
      bootstrapLoader: bootstrapLoaderRef.current,
      controlClient: controlPlaneClient,
      env: envRef.current,
      fetchImpl: fetchImplRef.current,
      auditLimit,
    });

    startTransition(() => {
      setViewState((previous) => ({
        ...previous,
        loading: false,
        working: false,
        error: "",
        notice: notice || previous.notice,
        ...snapshot,
      }));
    });
  }

  useEffect(() => {
    if (!autoLoad) {
      return undefined;
    }

    let active = true;

    async function runInitialLoad() {
      setViewState((previous) => ({
        ...previous,
        loading: true,
        working: true,
        error: "",
      }));

      try {
        const snapshot = await loadControlSnapshot({
          bootstrapLoader: bootstrapLoaderRef.current,
          controlClient: controlPlaneClient,
          env: envRef.current,
          fetchImpl: fetchImplRef.current,
          auditLimit,
        });

        if (!active) {
          return;
        }

        startTransition(() => {
          setViewState((previous) => ({
            ...previous,
            loading: false,
            working: false,
            error: "",
            ...snapshot,
          }));
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setViewState((previous) => ({
          ...previous,
          loading: false,
          working: false,
          error: normalizeErrorMessage(error, t),
        }));
      }
    }

    void runInitialLoad();

    return () => {
      active = false;
    };
  }, [auditLimit, autoLoad, controlPlaneClient, t]);

  async function runAction(action: () => Promise<unknown>, noticeBuilder: string | ((payload: unknown) => string)) {
    setViewState((previous) => ({
      ...previous,
      working: true,
      error: "",
    }));

    try {
      const payload = await action();
      const notice = typeof noticeBuilder === "function" ? noticeBuilder(payload) : noticeBuilder;
      await refreshSnapshot(notice);
      return payload;
    } catch (error) {
      setViewState((previous) => ({
        ...previous,
        working: false,
        error: normalizeErrorMessage(error, t),
      }));
      return null;
    }
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();

    const username = credentials.username.trim();
    if (!username || !credentials.password) {
      setViewState((previous) => ({
        ...previous,
        error: t("vipLocalControl.credentialsRequired", { defaultValue: "Vui lòng nhập tên đăng nhập và mật khẩu trước khi vào phiên cục bộ." }),
      }));
      return;
    }

    await runAction(
      () => controlPlaneClient.login({ username, password: credentials.password }),
      (payload: unknown) => {
        const p = payload as { session: SessionInfo };
        return t("vipLocalControl.loggedInAs", { defaultValue: "Đã đăng nhập bằng tài khoản " }) + p.session.principal!.username + ".";
      },
    );
  }

  async function handleLogout() {
    await runAction(
      () => controlPlaneClient.logout(),
      t("vipLocalControl.loggedOut", { defaultValue: "Đã đóng phiên cục bộ và trả shell về trạng thái chờ." }),
    );
  }

  async function handleResetSession() {
    await runAction(
      () => controlPlaneClient.resetSession(),
      (payload: unknown) => {
        const p = payload as { session: SessionInfo };
        return t("vipLocalControl.sessionRestored", { defaultValue: "Đã khôi phục phiên mặc định cho " }) + p.session.principal!.username + ".";
      },
    );
  }

  async function handleRefresh() {
    await runAction(
      async () => ({ ok: true }),
      t("vipLocalControl.refreshed", { defaultValue: "Đã làm mới snapshot đăng nhập, danh sách người dùng và nhật ký audit." }),
    );
  }

  async function handleUserSubmit(event: React.FormEvent) {
    event.preventDefault();

    const username = userDraft.username.trim();
    if (!username) {
      setViewState((previous) => ({
        ...previous,
        error: t("vipLocalControl.usernameRequired", { defaultValue: "Tên đăng nhập cho người dùng VIP không được để trống." }),
      }));
      return;
    }

    const nextPayload: {
      username: string;
      email: string;
      role_keys: string[];
      password?: string;
    } = {
      username,
      email: userDraft.email.trim() || `${username}@vninvest.local`,
      role_keys: [userDraft.roleKey],
    };

    if (userDraft.password) {
      nextPayload.password = userDraft.password;
    }

    const result = await runAction(
      () => controlPlaneClient.upsertUser(nextPayload),
      (payload: unknown) => {
        const p = payload as { user: User; created: boolean };
        return p.created
          ? t("vipLocalControl.userCreated", { defaultValue: "Đã tạo người dùng " }) + p.user.username + t("vipLocalControl.userCreatedSuffix", { defaultValue: " trong local backend." })
          : t("vipLocalControl.userUpdated", { defaultValue: "Đã cập nhật người dùng " }) + p.user.username + ".";
      },
    );

    if (result) {
      setUserDraft(createUserDraft(initialUserDraft));
    }
  }

  const currentSessionUsername = viewState.session?.principal?.username || t("vipLocalControl.notLoggedIn", { defaultValue: "Chưa đăng nhập" });
  const currentSessionId = viewState.session?.session_id || t("vipLocalControl.noSession", { defaultValue: "Không có phiên" });
  const abilityCount = Array.isArray(viewState.capabilities?.abilities)
    ? viewState.capabilities.abilities.length
    : 0;
  const visibleRouteCount = Array.isArray(viewState.capabilities?.navigation?.visible_routes)
    ? viewState.capabilities.navigation.visible_routes.length
    : 0;

  const metrics = [
    renderShellMetric(t("vipLocalControl.metricSession", { defaultValue: "Phiên hiện tại" }), currentSessionUsername),
    renderShellMetric(t("vipLocalControl.metricLocalUsers", { defaultValue: "Người dùng cục bộ" }), String(viewState.users.length)),
    renderShellMetric(t("vipLocalControl.metricAuditRecords", { defaultValue: "Bản ghi audit" }), String(viewState.auditLogs.length)),
    renderShellMetric(t("vipLocalControl.metricLoadedAbilities", { defaultValue: "Quyền đã nạp" }), String(abilityCount)),
  ];

  const sessionCards = (
    <>
      <article className={`${styles.surfaceCard}`} key="session">
        <h3 className={`${styles.itemTitle}`}>{t("vipLocalControl.sessionSummary", { defaultValue: "Tóm tắt phiên local" })}</h3>
        <p className={`${styles.itemMeta}`}>{t("vipLocalControl.accountLabel", { defaultValue: "Tài khoản" })}: {currentSessionUsername}</p>
        <p className={`${styles.itemMeta}`}>{t("vipLocalControl.sessionIdLabel", { defaultValue: "Mã phiên" })}: {currentSessionId}</p>
      </article>
      <article className={`${styles.surfaceCard}`} key="surface">
        <h3 className={`${styles.itemTitle}`}>{t("vipLocalControl.healthRoutesTitle", { defaultValue: "Health và route đang mở" })}</h3>
        <p className={`${styles.itemMeta}`}>{t("vipLocalControl.serviceLabel", { defaultValue: "Dịch vụ" })}: {viewState.health?.service || "vip-app-local-api"}</p>
        <p className={`${styles.itemMeta}`}>{t("vipLocalControl.visibleRoutesLabel", { defaultValue: "Route nhìn thấy" })}: {visibleRouteCount}</p>
      </article>
    </>
  );

  const userList = viewState.users.length > 0
    ? <ul className={`${styles.list}`} key="user-list">{viewState.users.map((user) => renderUserItem(user, t))}</ul>
    : <div className={`${styles.empty}`} key="user-empty">{t("vipLocalControl.noUsers", { defaultValue: "Local backend chưa có người dùng nào ngoài seed user." })}</div>;

  const auditList = viewState.auditLogs.length > 0
    ? <ol className={`${styles.list}`} key="audit-list">{viewState.auditLogs.map((entry) => renderAuditItem(entry, t))}</ol>
    : <div className={`${styles.empty}`} key="audit-empty">{t("vipLocalControl.noAuditLogs", { defaultValue: "Nhật ký audit chưa có bản ghi nào để hiển thị." })}</div>;

  return (
    <ShellPageChrome
      eyebrow={t("vipLocalControl.eyebrow", { defaultValue: "VIP local control" })}
      title={t("vipLocalControl.title", { defaultValue: "Trung tâm điều khiển VIP cục bộ" })}
      description={t("vipLocalControl.description", { defaultValue: "Bề mặt này neo trực tiếp vào local backend của VIP để đăng nhập thử, rà soát tài khoản con và đọc chuỗi audit gần nhất mà không cần tự ghép URL ngoài adapter seam." })}
      badge={
        <div className={`${styles.heroBadge}`}>
          <span className={`${styles.statusDot}`} />
          {viewState.loading || viewState.working ? t("vipLocalControl.syncing", { defaultValue: "Đang đồng bộ local backend" }) : t("vipLocalControl.ready", { defaultValue: "Local backend sẵn sàng cho audit" })}
        </div>
      }
      metrics={metrics}
      notice={viewState.notice}
      error={viewState.error}
    >
      <section className={`${styles.bodyGrid}`}>
        <div className={`${styles.stack}`}>
          <ShellPanel
            title={t("vipLocalControl.loginPanelTitle", { defaultValue: "Đăng nhập và phục hồi phiên" })}
            subtitle={t("vipLocalControl.loginPanelSubtitle", { defaultValue: "Dùng seed account mặc định hoặc đăng nhập bằng sub-user đã tạo ngay trong local backend." })}
            actions={
              <div className={`${styles.actions}`}>
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonSecondary}`}
                  onClick={handleRefresh}
                  disabled={viewState.working}
                >
                  {t("vipLocalControl.refreshSnapshot", { defaultValue: "Làm mới snapshot" })}
                </button>
              </div>
            }
          >
            <section className={`${styles.summaryGrid}`} key="session-grid">
              {sessionCards}
            </section>
            <form className={`${styles.form}`} onSubmit={handleLogin} key="login-form">
              <div className={`${styles.formGrid}`}>
                <ShellField
                  label={t("vipLocalControl.localUsername", { defaultValue: "Tên đăng nhập local" })}
                  name="vip-local-username"
                  value={credentials.username}
                  placeholder="vip-local-admin"
                  autoComplete="username"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    const nextValue = event.target.value;
                    setCredentials((previous) => ({ ...previous, username: nextValue }));
                  }}
                />
                <ShellField
                  label={t("vipLocalControl.localPassword", { defaultValue: "Mật khẩu local" })}
                  name="vip-local-password"
                  type="password"
                  value={credentials.password}
                  placeholder="vip-demo-pass"
                  autoComplete="current-password"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    const nextValue = event.target.value;
                    setCredentials((previous) => ({ ...previous, password: nextValue }));
                  }}
                />
              </div>
              <div className={`${styles.actions}`}>
                <button
                  type="submit"
                  className={`${styles.button} ${styles.buttonPrimary}`}
                  disabled={viewState.working}
                >
                  {t("vipLocalControl.loginLocal", { defaultValue: "Đăng nhập local" })}
                </button>
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonSignal}`}
                  onClick={handleResetSession}
                  disabled={viewState.working}
                >
                  {t("vipLocalControl.resetSeed", { defaultValue: "Khôi phục phiên seed" })}
                </button>
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonSecondary}`}
                  onClick={handleLogout}
                  disabled={viewState.working}
                >
                  {t("vipLocalControl.logout", { defaultValue: "Đóng phiên" })}
                </button>
              </div>
            </form>
          </ShellPanel>
          <ShellPanel
            title={t("vipLocalControl.usersTitle", { defaultValue: "Danh sách người dùng cục bộ" })}
            subtitle={t("vipLocalControl.usersSubtitle", { defaultValue: "Tạo nhanh sub-user để test lane operator/admin trước khi dựng các surface sâu hơn." })}
          >
            <form className={`${styles.form}`} onSubmit={handleUserSubmit} key="user-form">
              <div className={`${styles.formGrid}`}>
                <ShellField
                  label={t("vipLocalControl.newUsername", { defaultValue: "Tên đăng nhập mới" })}
                  name="vip-user-username"
                  value={userDraft.username}
                  placeholder="vip-operator"
                  autoComplete="off"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    const nextValue = event.target.value;
                    setUserDraft((previous) => ({ ...previous, username: nextValue }));
                  }}
                />
                <ShellField
                  label={t("vipLocalControl.displayEmail", { defaultValue: "Email hiển thị" })}
                  name="vip-user-email"
                  type="email"
                  value={userDraft.email}
                  placeholder="vip-operator@vninvest.local"
                  autoComplete="off"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    const nextValue = event.target.value;
                    setUserDraft((previous) => ({ ...previous, email: nextValue }));
                  }}
                />
                <ShellSelectField
                  label={t("vipLocalControl.localRole", { defaultValue: "Vai trò local" })}
                  name="vip-user-role"
                  value={userDraft.roleKey}
                  options={ROLE_KEYS.map((key) => ({ key, label: roleLabel(key, t) }))}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                    const nextValue = event.target.value;
                    setUserDraft((previous) => ({ ...previous, roleKey: nextValue }));
                  }}
                />
                <ShellField
                  label={t("vipLocalControl.newPassword", { defaultValue: "Mật khẩu mới (tuỳ chọn)" })}
                  name="vip-user-password"
                  type="password"
                  value={userDraft.password}
                  placeholder={t("vipLocalControl.newPasswordPlaceholder", { defaultValue: "Để trống để dùng mật khẩu seed" })}
                  autoComplete="new-password"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    const nextValue = event.target.value;
                    setUserDraft((previous) => ({ ...previous, password: nextValue }));
                  }}
                />
              </div>
              <div className={`${styles.actions}`}>
                <button
                  type="submit"
                  className={`${styles.button} ${styles.buttonPrimary}`}
                  disabled={viewState.working}
                >
                  {t("vipLocalControl.saveLocalUser", { defaultValue: "Lưu người dùng local" })}
                </button>
              </div>
            </form>
            {userList}
          </ShellPanel>
        </div>
        <ShellPanel
          title={t("vipLocalControl.auditTitle", { defaultValue: "Nhật ký audit gần nhất" })}
          subtitle={t("vipLocalControl.auditSubtitle", { defaultValue: "Theo dõi nhanh chuỗi đăng nhập, reset phiên và thay đổi RBAC để auditor có thể kiểm tra ngay trên route local control." })}
          actions={
            <div className={`${styles.actions}`}>
              <span className={`${styles.pill}`}>{t("vipLocalControl.healthLabel", { defaultValue: "Health" })}: {viewState.health?.ok ? "OK" : t("vipLocalControl.unconfirmed", { defaultValue: "Chưa xác nhận" })}</span>
            </div>
          }
        >
          {auditList}
        </ShellPanel>
      </section>
    </ShellPageChrome>
  );
}
