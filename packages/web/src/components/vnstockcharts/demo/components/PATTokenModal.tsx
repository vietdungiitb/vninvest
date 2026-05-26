/**
 * OB-M03 — PATTokenModal
 * Source selector modal: Binance info, Offline file loader, VNInvest token/login/register.
 * Never logs PAT values to console.
 */
import { useState, useRef, useEffect } from "react";
import { useDemoI18n } from "../i18n";
import { DataSourceSwitcher, type ActiveSource } from "./DataSourceSwitcher";
import { VNInvestClient } from "../dataSources/VNInvestClient";

type Tab = "paste" | "login" | "register";

export interface ParsedFileBar {
	timestamp: number; open: number; high: number; low: number; close: number; volume: number;
}

export interface PATTokenModalProps {
	isOpen: boolean;
	client: VNInvestClient;
	activeSource: ActiveSource;
	onSourceChange: (source: ActiveSource) => void;
	onClose: () => void;
	/** Called after PAT is successfully saved. */
	onSaved: (hasToken: boolean) => void;
	/** Called after the active VNInvest connection settings change. */
	onConfigChange?: () => void;
	/** Called after a local file is parsed successfully. */
	onFileLoaded?: (bars: ParsedFileBar[], filename: string) => void;
	initialTab?: Tab;
}

function parseCSVBars(text: string): ParsedFileBar[] {
	const lines = text.trim().split("\n").filter(Boolean);
	if (lines.length < 2) return [];
	const firstField = lines[0].split(",")[0].trim().replace(/"/g, "");
	const hasHeader = isNaN(Number(firstField)) && isNaN(Date.parse(firstField) / 1000);
	const dataLines = hasHeader ? lines.slice(1) : lines;
	return dataLines.flatMap((line) => {
		const cols = line.split(",").map((c) => c.trim().replace(/"/g, ""));
		if (cols.length < 5) return [];
		const [dateStr, o, h, l, c, v = "0"] = cols;
		const ts = isNaN(Number(dateStr)) ? Date.parse(dateStr) : Number(dateStr) * (Number(dateStr) < 1e12 ? 1000 : 1);
		if (!ts || isNaN(ts)) return [];
		const open = Number(o), high = Number(h), low = Number(l), close = Number(c), volume = Number(v);
		if ([open, high, low, close].some(isNaN)) return [];
		return [{ timestamp: ts, open, high, low, close, volume: isNaN(volume) ? 0 : volume }];
	});
}

/**
 * Zero-dependency, script-based Cloudflare Turnstile explicit rendering component.
 */
function TurnstileWidget({ onVerify, onError }: { onVerify: (token: string) => void; onError?: () => void }) {
	const containerRef = useRef<HTMLDivElement>(null);
	const widgetIdRef = useRef<string | null>(null);

	useEffect(() => {
		const win = window as any;
		if (!win.turnstile) {
			const script = document.createElement("script");
			script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
			script.async = true;
			script.defer = true;
			document.body.appendChild(script);
			script.onload = renderWidget;
		} else {
			renderWidget();
		}

		function renderWidget() {
			const win = window as any;
			if (win.turnstile && containerRef.current && !widgetIdRef.current) {
				const siteKey = "1x00000000000000000000AA"; // Dummy test key for Cloudflare
				widgetIdRef.current = win.turnstile.render(containerRef.current, {
					sitekey: siteKey,
					theme: "dark",
					callback: (token: string) => {
						onVerify(token);
					},
					"error-callback": () => {
						if (onError) onError();
					},
				});
			}
		}

		return () => {
			const win = window as any;
			if (win.turnstile && widgetIdRef.current) {
				win.turnstile.remove(widgetIdRef.current);
				widgetIdRef.current = null;
			}
		};
	}, [onVerify, onError]);

	return <div ref={containerRef} style={{ display: "flex", justifyContent: "center", margin: "12px 0" }} />;
}

interface ApiErrorResponse {
	detail: string;
	code: string;
	field_errors: Record<string, string[]>;
}

function parseApiErrors(data: any): ApiErrorResponse {
	if (data) {
		const detail = data.detail;
		if (typeof detail === "object" && detail !== null) {
			return {
				detail: "Dữ liệu đăng ký không hợp lệ. Vui lòng kiểm tra lại các trường đỏ bên dưới.",
				code: data.code || "validation_error",
				field_errors: detail as Record<string, string[]>,
			};
		}
		return {
			detail: typeof detail === "string" ? detail : "Đã xảy ra lỗi không xác định.",
			code: data.code || "unknown_error",
			field_errors: {} as Record<string, string[]>,
		};
	}
	return {
		detail: "Không thể kết nối đến máy chủ đầu tư.",
		code: "network_error",
		field_errors: {} as Record<string, string[]>,
	};
}

export function PATTokenModal({
	isOpen,
	client,
	activeSource,
	onSourceChange,
	onClose,
	onSaved,
	onConfigChange,
	onFileLoaded,
	initialTab = "paste",
}: PATTokenModalProps) {
	const { t } = useDemoI18n();
	const [activeTab, setActiveTab] = useState<Tab>(initialTab);
	const [pasteValue, setPasteValue] = useState("");
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
	const [errorMsg, setErrorMsg] = useState("");
	const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
	const [apiBaseInput, setApiBaseInput] = useState(() => client.getBase());
	const fileInputRef = useRef<HTMLInputElement>(null);
	const backdropRef = useRef<HTMLDivElement>(null);

	// Registration Tab state fields
	const [regUsername, setRegUsername] = useState("");
	const [regEmail, setRegEmail] = useState("");
	const [regPassword, setRegPassword] = useState("");
	const [regPasswordConfirm, setRegPasswordConfirm] = useState("");
	const [regFirstName, setRegFirstName] = useState("");
	const [regLastName, setRegLastName] = useState("");
	const [website, setWebsite] = useState(""); // Honeypot field
	const [turnstileToken, setTurnstileToken] = useState("");
	const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

	// Reset form on open
	useEffect(() => {
		if (isOpen) {
			setActiveTab(initialTab);
			setPasteValue("");
			setUsername("");
			setPassword("");
			setStatus("idle");
			setErrorMsg("");
			setApiBaseInput(client.getBase());
			
			// Clear register tab state
			setRegUsername("");
			setRegEmail("");
			setRegPassword("");
			setRegPasswordConfirm("");
			setRegFirstName("");
			setRegLastName("");
			setWebsite("");
			setTurnstileToken("");
			setFieldErrors({});
		}
	}, [client, initialTab, isOpen]);

	function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
		if (e.target === backdropRef.current) onClose();
	}

	function applyApiBaseInput(): { base: string; changed: boolean } {
		const trimmed = apiBaseInput.trim().replace(/\/+$/, "");
		if (!trimmed) {
			return { base: client.getBase(), changed: false };
		}
		const currentBase = client.getBase();
		const changed = trimmed !== currentBase;
		if (changed) {
			client.setBase(trimmed);
		}
		setApiBaseInput(trimmed);
		return { base: trimmed, changed };
		
	}

	function handleSaveToken() {
		const token = pasteValue.trim();
		if (!token) {
			setStatus("error");
			setErrorMsg(t("vninvest.error.noPAT"));
			return;
		}
		applyApiBaseInput();
		client.setPAT(token);
		onConfigChange?.();
		setStatus("success");
		onSaved(true);
	}

	function handleClearToken() {
		client.setPAT("");
		setPasteValue("");
		setStatus("idle");
		onSaved(false);
	}

	function handleSaveBase() {
		const { changed } = applyApiBaseInput();
		if (changed) {
			onConfigChange?.();
		}
	}

	async function handleLogin() {
		const u = username.trim();
		const p = password.trim();
		if (!u || !p) {
			setStatus("error");
			setErrorMsg(t("vninvest.patModal.status.error"));
			return;
		}
		setStatus("loading");
		setErrorMsg("");
		try {
			const { base } = applyApiBaseInput();
			const res = await fetch(`${base}/api/auth/token/`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username: u, password: p }),
			});
			if (!res.ok) throw new Error("AUTH_FAILED");
			const data = await res.json() as { access?: string };
			const accessToken = data.access;
			if (!accessToken || typeof accessToken !== "string") throw new Error("NO_TOKEN");
			client.setPAT(accessToken);
			onConfigChange?.();
			setStatus("success");
			onSaved(true);
		} catch {
			setStatus("error");
			setErrorMsg(t("vninvest.patModal.status.error"));
		}
	}

	async function handleRegister() {
		const u = regUsername.trim();
		const e = regEmail.trim();
		const p = regPassword.trim();
		const pc = regPasswordConfirm.trim();
		const fn = regFirstName.trim();
		const ln = regLastName.trim();
		const ws = website.trim();

		if (!u || !e || !p || !pc) {
			setStatus("error");
			setErrorMsg("Vui lòng điền đầy đủ các trường bắt buộc.");
			return;
		}

		if (p !== pc) {
			setStatus("error");
			setErrorMsg("Mật khẩu xác nhận không khớp.");
			setFieldErrors({ password_confirm: ["Mật khẩu xác nhận không khớp."] });
			return;
		}

		setStatus("loading");
		setErrorMsg("");
		setFieldErrors({});

		try {
			const { base } = applyApiBaseInput();
			const response = await fetch(`${base}/api/auth/register/`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					username: u,
					email: e,
					password: p,
					password_confirm: pc,
					first_name: fn,
					last_name: ln,
					website: ws,
					turnstile_token: turnstileToken,
				}),
			});

			const resJson = await response.json();

			if (!response.ok) {
				const parsed = parseApiErrors(resJson);
				setStatus("error");
				setErrorMsg(parsed.detail);
				setFieldErrors(parsed.field_errors);
			} else {
				setStatus("success");
				// Clear inputs
				setRegUsername("");
				setRegEmail("");
				setRegPassword("");
				setRegPasswordConfirm("");
				setRegFirstName("");
				setRegLastName("");
				setWebsite("");
				setTurnstileToken("");
				setFieldErrors({});
			}
		} catch (err) {
			setStatus("error");
			setErrorMsg("Lỗi kết nối mạng vật lý. Vui lòng thử lại sau.");
		}
	}

	function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (ev) => {
			const text = ev.target?.result;
			if (typeof text !== "string") return;
			const bars = parseCSVBars(text);
			if (bars.length === 0) {
				setStatus("error");
				setErrorMsg(t("dataSource.offline.hint"));
				return;
			}
			setLoadedFileName(file.name);
			setStatus("success");
			onFileLoaded?.(bars, file.name);
		};
		reader.readAsText(file);
		// Reset input so same file can be re-selected
		e.target.value = "";
	}

	if (!isOpen) return null;

	return (
		<div
			ref={backdropRef}
			className="gc-modal-backdrop"
			role="dialog"
			aria-modal="true"
			aria-label={t("vninvest.patModal.title")}
			onClick={handleBackdropClick}
		>
			<div className="gc-modal gc-pat-modal">
				<div className="gc-modal__header">
					<span className="gc-modal__title">{t("vninvest.patModal.title")}</span>
					<button className="gc-modal__close" onClick={onClose} type="button" aria-label={t("settings.dialogClose")}>
						✕
					</button>
				</div>
				<div className="gc-modal__body">
					<div className="gc-pat-modal__source">
						<div className="gc-form-label">{t("dataSource.label")}</div>
						<DataSourceSwitcher activeSource={activeSource} onSwitch={onSourceChange} />
					</div>

					{activeSource === "binance" && (
						<div className="gc-pat-source-info">
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
								<circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
								<line x1="8" y1="5" x2="8" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
								<circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
							</svg>
							<span>{t("dataSource.binance.info")}</span>
						</div>
					)}

					{activeSource === "offline" && (
						<div className="gc-pat-offline">
							<p className="gc-form-label">{t("dataSource.offline.selectFile")}</p>
							<p className="gc-pat-offline__hint">{t("dataSource.offline.hint")}</p>
							<div className="gc-pat-tab__actions">
								<button
									className="gc-btn gc-btn--primary"
									type="button"
									onClick={() => fileInputRef.current?.click()}
								>
									{t("dataSource.offline.selectFile")}
								</button>
								{loadedFileName && (
									<span className="gc-pat-offline__loaded">
										{t("dataSource.offline.loaded")} <strong>{loadedFileName}</strong>
									</span>
								)}
							</div>
							<input
								ref={fileInputRef}
								type="file"
								accept=".csv,.tsv,.txt,.json"
								hidden
								onChange={handleFileChange}
							/>
						</div>
					)}

					{activeSource === "vninvest" && (
						<>
							<div className="gc-pat-tab">
								<label htmlFor="gc-api-base-input" className="gc-form-label">
									{t("vninvest.patModal.input.serverUrl")}
								</label>
								<div style={{ display: "flex", gap: 6 }}>
									<input
										id="gc-api-base-input"
										className="gc-form-input"
										type="url"
										value={apiBaseInput}
										onChange={(e) => setApiBaseInput(e.target.value)}
										placeholder="http://127.0.0.1"
										autoComplete="off"
										onKeyDown={(e) => { if (e.key === "Enter") handleSaveBase(); }}
										style={{ flex: 1 }}
									/>
									<button className="gc-btn gc-btn--ghost" onClick={handleSaveBase} type="button">
										{t("vninvest.patModal.btn.setServer")}
									</button>
								</div>
							</div>
							<div className="gc-modal__tabs">
								<button
									className={`gc-modal__tab${activeTab === "paste" ? " gc-modal__tab--active" : ""}`}
									onClick={() => setActiveTab("paste")}
									type="button"
								>
									{t("vninvest.patModal.tab.paste")}
								</button>
								<button
									className={`gc-modal__tab${activeTab === "login" ? " gc-modal__tab--active" : ""}`}
									onClick={() => setActiveTab("login")}
									type="button"
								>
									{t("vninvest.patModal.tab.login")}
								</button>
								<button
									className={`gc-modal__tab${activeTab === "register" ? " gc-modal__tab--active" : ""}`}
									onClick={() => setActiveTab("register")}
									type="button"
								>
									{t("profile.register") || "Đăng ký"}
								</button>
							</div>
							{activeTab === "paste" && (
								<div className="gc-pat-tab">
									<label htmlFor="gc-pat-input" className="gc-form-label">
										{t("vninvest.patModal.input.token")}
									</label>
									<input
										id="gc-pat-input"
										className="gc-form-input"
										type="password"
										value={pasteValue}
										onChange={(e) => setPasteValue(e.target.value)}
										placeholder={t("vninvest.patModal.input.token")}
										autoComplete="off"
									/>
									<div className="gc-pat-tab__actions">
										<button className="gc-btn gc-btn--primary" onClick={handleSaveToken} type="button">
											{t("vninvest.patModal.btn.save")}
										</button>
										<button className="gc-btn gc-btn--ghost" onClick={handleClearToken} type="button">
											{t("vninvest.patModal.btn.clear")}
										</button>
									</div>
								</div>
							)}
							{activeTab === "login" && (
								<div className="gc-login-tab">
									<label htmlFor="gc-login-username" className="gc-form-label">
										{t("vninvest.patModal.input.username")}
									</label>
									<input
										id="gc-login-username"
										className="gc-form-input"
										type="text"
										value={username}
										onChange={(e) => setUsername(e.target.value)}
										autoComplete="username"
									/>
									<label htmlFor="gc-login-password" className="gc-form-label">
										{t("vninvest.patModal.input.password")}
									</label>
									<input
										id="gc-login-password"
										className="gc-form-input"
										type="password"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										autoComplete="current-password"
									/>
									<div className="gc-pat-tab__actions">
										<button
											className="gc-btn gc-btn--primary"
											onClick={() => void handleLogin()}
											type="button"
											disabled={status === "loading"}
										>
											{status === "loading" ? t("common.loading") : t("vninvest.patModal.btn.login")}
										</button>
									</div>
								</div>
							)}
							{activeTab === "register" && (
								<div className="gc-login-tab" style={{ maxHeight: "400px", overflowY: "auto", paddingRight: "6px" }}>
									<div style={{ display: "flex", gap: 10 }}>
										<div style={{ flex: 1 }}>
											<label htmlFor="gc-reg-first-name" className="gc-form-label">Tên</label>
											<input
												id="gc-reg-first-name"
												className="gc-form-input"
												type="text"
												value={regFirstName}
												onChange={(e) => setRegFirstName(e.target.value)}
												placeholder="Dũng"
											/>
										</div>
										<div style={{ flex: 1 }}>
											<label htmlFor="gc-reg-last-name" className="gc-form-label">Họ</label>
											<input
												id="gc-reg-last-name"
												className="gc-form-input"
												type="text"
												value={regLastName}
												onChange={(e) => setRegLastName(e.target.value)}
												placeholder="Phạm Việt"
											/>
										</div>
									</div>

									<label htmlFor="gc-reg-username" className="gc-form-label">Tên đăng nhập *</label>
									<input
										id="gc-reg-username"
										className={`gc-form-input ${fieldErrors.username ? 'gc-form-input--error' : ''}`}
										type="text"
										value={regUsername}
										onChange={(e) => setRegUsername(e.target.value)}
										placeholder="vietdung"
										autoComplete="username"
										style={fieldErrors.username ? { borderColor: "hsl(0, 100%, 60%)" } : {}}
									/>
									{fieldErrors.username && <span style={{ color: "hsl(0, 100%, 65%)", fontSize: 11 }}>{fieldErrors.username[0]}</span>}

									<label htmlFor="gc-reg-email" className="gc-form-label">Địa chỉ Email *</label>
									<input
										id="gc-reg-email"
										className={`gc-form-input ${fieldErrors.email ? 'gc-form-input--error' : ''}`}
										type="email"
										value={regEmail}
										onChange={(e) => setRegEmail(e.target.value)}
										placeholder="dung@vninvest.vn"
										autoComplete="email"
										style={fieldErrors.email ? { borderColor: "hsl(0, 100%, 60%)" } : {}}
									/>
									{fieldErrors.email && <span style={{ color: "hsl(0, 100%, 65%)", fontSize: 11 }}>{fieldErrors.email[0]}</span>}

									<label htmlFor="gc-reg-password" className="gc-form-label">Mật khẩu *</label>
									<input
										id="gc-reg-password"
										className={`gc-form-input ${fieldErrors.password ? 'gc-form-input--error' : ''}`}
										type="password"
										value={regPassword}
										onChange={(e) => setRegPassword(e.target.value)}
										placeholder="Mật khẩu bảo mật"
										autoComplete="new-password"
										style={fieldErrors.password ? { borderColor: "hsl(0, 100%, 60%)" } : {}}
									/>
									{fieldErrors.password && <span style={{ color: "hsl(0, 100%, 65%)", fontSize: 11 }}>{fieldErrors.password[0]}</span>}

									<label htmlFor="gc-reg-password-confirm" className="gc-form-label">Xác nhận Mật khẩu *</label>
									<input
										id="gc-reg-password-confirm"
										className={`gc-form-input ${fieldErrors.password_confirm ? 'gc-form-input--error' : ''}`}
										type="password"
										value={regPasswordConfirm}
										onChange={(e) => setRegPasswordConfirm(e.target.value)}
										placeholder="Nhập lại mật khẩu"
										autoComplete="new-password"
										style={fieldErrors.password_confirm ? { borderColor: "hsl(0, 100%, 60%)" } : {}}
									/>
									{fieldErrors.password_confirm && <span style={{ color: "hsl(0, 100%, 65%)", fontSize: 11 }}>{fieldErrors.password_confirm[0]}</span>}

									{/* HONEYPOT SPAM SHIELD: Hidden absolutely off-screen */}
									<div style={{ position: "absolute", left: "-9999px", top: "auto", width: "1px", height: "1px", overflow: "hidden", opacity: 0, pointerEvents: "none", zIndex: -1 }} aria-hidden="true">
										<label htmlFor="website">Website cá nhân</label>
										<input
											id="website"
											type="text"
											name="website"
											value={website}
											onChange={(e) => setWebsite(e.target.value)}
											tabIndex={-1}
											autoComplete="off"
										/>
									</div>

									{/* Turnstile Captcha Widget */}
									<TurnstileWidget
										onVerify={(token) => setTurnstileToken(token)}
										onError={() => {
											setStatus("error");
											setErrorMsg("Cloudflare Turnstile không thể tải. Vui lòng kiểm tra lại kết nối mạng.");
										}}
									/>
									{fieldErrors.turnstile_token && <span style={{ color: "hsl(0, 100%, 65%)", fontSize: 11, display: "block", textAlign: "center" }}>{fieldErrors.turnstile_token[0]}</span>}

									<div className="gc-pat-tab__actions" style={{ marginTop: 10 }}>
										<button
											className="gc-btn gc-btn--primary"
											onClick={() => void handleRegister()}
											type="button"
											disabled={status === "loading" || !turnstileToken}
											style={{ width: "100%" }}
										>
											{status === "loading" ? "Đang xử lý..." : "Đăng ký Thành viên"}
										</button>
									</div>
								</div>
							)}
						</>
					)}

					{status === "success" && (
						<div className="gc-form-feedback gc-form-feedback--success">
							{activeTab === "register"
								? "Đăng ký thành công! Chúng tôi đã gửi một email xác thực đến địa chỉ của bạn. Vui lòng kiểm tra hộp thư."
								: t("vninvest.patModal.status.success")}
						</div>
					)}
					{status === "error" && (
						<div className="gc-form-feedback gc-form-feedback--error">{errorMsg}</div>
					)}
				</div>
			</div>
		</div>
	);
}
