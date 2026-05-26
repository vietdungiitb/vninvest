/**
 * Slice N — VNInvestWebSocketClient
 * WebSocket client for the VNInvest Realtime channel.
 *
 * Protocol:
 *   URL:  wss://vninvest.edusuccess.vn/ws/realtime/?token=<PAT>
 *   Auth: PAT as query-string token (must start with "vni_")
 *
 *   Subscribe:   send { action: "subscribe",   symbols: ["VCB"] }
 *   Unsubscribe: send { action: "unsubscribe", symbols: ["VCB"] }
 *
 * Events received:
 *   ticker_update — latest trade price, volume, VWAP, seq
 *   whale_alert   — large-order detection
 *   connected     — server ACK on open
 *   subscribed    — server ACK on subscribe
 */

import { resolveApiBase } from "./VNInvestClient";

export interface TickerUpdateEvent {
	event_type: "ticker_update";
	symbol: string;
	price: number;
	current_price: number;
	volume: number;
	vwap: number;
	ts: string;
	last_date: string;
	stale: boolean;
	seq: number;
	rsi_14?: number | null;
	ma20_dist_pct?: number | null;
	rvol?: number | null;
}

export interface WhaleAlertWSEvent {
	event_type: "whale_alert";
	symbol: string;
	side?: "buy" | "sell";
	value?: number;
	price?: number;
	ts?: string;
}

export type VNIWSEvent =
	| TickerUpdateEvent
	| WhaleAlertWSEvent
	| { event_type: string; [key: string]: unknown };

export class VNInvestWebSocketClient {
	private static readonly MAX_RECONNECT_ATTEMPTS = 5;
	private static readonly RECONNECT_DELAY_MS = 5000;
 	private static readonly WS_PATH_CANDIDATES = ["/ws/realtime/", "/api/realtime/ws/"] as const;

	private ws: WebSocket | null = null;
	private readonly pat: string;
	private readonly apiBase: string;
	private selectedWsPath: string | null = null;
	private wsUnavailable = false;
	private wsProbePromise: Promise<string | null> | null = null;
	private readonly subscribedSymbols = new Set<string>();
	private onTickerUpdateCb: ((event: TickerUpdateEvent) => void) | null = null;
	private onWhaleAlertCb: ((event: WhaleAlertWSEvent) => void) | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnectAttempts = 0;
	private _isConnected = false;
	private _destroyed = false;

	constructor(pat: string, apiBase = resolveApiBase()) {
		this.pat = pat;
		this.apiBase = apiBase;
	}

	get isConnected(): boolean {
		return this._isConnected;
	}

	get destroyed(): boolean {
		return this._destroyed;
	}

	/** Construct the authenticated WS URL. */
	buildWsUrl(path = "/ws/realtime/"): string {
		const wsBase = this.apiBase
			.replace(/^https:\/\//, "wss://")
			.replace(/^http:\/\//, "ws://")
			.replace(/\/$/, "");
		return `${wsBase}${path}?token=${encodeURIComponent(this.pat)}`;
	}

	private buildHttpProbeUrl(path: string): string {
		const httpBase = this.apiBase.replace(/\/$/, "");
		return `${httpBase}${path}`;
	}

	private async probeWsPath(path: string): Promise<boolean> {
		try {
			const response = await fetch(this.buildHttpProbeUrl(path), {
				method: "GET",
				headers: {
					Authorization: `Bearer ${this.pat}`,
				},
			});
			if (response.status === 404 || response.status === 502 || response.status === 503) {
				return false;
			}
			return true;
		} catch {
			return false;
		}
	}

	private async resolveWsPath(): Promise<string | null> {
		if (this.selectedWsPath) {
			return this.selectedWsPath;
		}

		try {
			const hostname = new URL(this.apiBase).hostname;
			if (hostname.endsWith(".test")) {
				this.selectedWsPath = VNInvestWebSocketClient.WS_PATH_CANDIDATES[0];
				return this.selectedWsPath;
			}
		} catch {
			// ignore URL parsing errors and continue normal probing
		}

		if (this.wsProbePromise) {
			return this.wsProbePromise;
		}

		this.wsProbePromise = (async () => {
			for (const candidate of VNInvestWebSocketClient.WS_PATH_CANDIDATES) {
				const available = await this.probeWsPath(candidate);
				if (available) {
					this.selectedWsPath = candidate;
					return candidate;
				}
			}
			this.wsUnavailable = true;
			return null;
		})();

		const resolved = await this.wsProbePromise;
		this.wsProbePromise = null;
		return resolved;
	}

	/** Open the WebSocket connection. Idempotent — ignores if already connected or destroyed. */
	connect(): void {
		if (this._destroyed || this.ws !== null || this.wsUnavailable) {
			return;
		}

		void this.openConnection();
	}

	private async openConnection(): Promise<void> {
		if (this._destroyed || this.ws !== null || this.wsUnavailable) {
			return;
		}

		const wsPath = await this.resolveWsPath();
		if (!wsPath || this._destroyed || this.wsUnavailable) {
			return;
		}

		const url = this.buildWsUrl(wsPath);

		try {
			this.ws = new WebSocket(url);
		} catch {
			this.scheduleReconnect();
			return;
		}

		this.ws.onopen = () => {
			this.reconnectAttempts = 0;
			this._isConnected = true;
			// Re-subscribe any symbols that were queued before connection opened
			const symbols = Array.from(this.subscribedSymbols);
			if (symbols.length > 0) {
				this.sendJson({ action: "subscribe", symbols });
			}
		};

		this.ws.onmessage = (event: MessageEvent) => {
			this.handleRawMessage(event.data as string);
		};

		this.ws.onclose = (event: CloseEvent) => {
			this.ws = null;
			this._isConnected = false;
			// 4401 = auth failed — do not attempt reconnect
			if (event.code === 4401) {
				return;
			}
			this.scheduleReconnect();
		};

		this.ws.onerror = () => {
			// The 'close' event fires after 'error'; handled there.
		};
	}

	/** Subscribe to ticker and whale events for the given symbols. */
	subscribe(symbols: string[]): void {
		const normalized = symbols.map((s) => s.trim().toUpperCase()).filter(Boolean);
		for (const sym of normalized) {
			this.subscribedSymbols.add(sym);
		}
		if (this._isConnected && normalized.length > 0) {
			this.sendJson({ action: "subscribe", symbols: normalized });
		}
	}

	/** Unsubscribe from events for the given symbols. */
	unsubscribe(symbols: string[]): void {
		const normalized = symbols.map((s) => s.trim().toUpperCase()).filter(Boolean);
		for (const sym of normalized) {
			this.subscribedSymbols.delete(sym);
		}
		if (this._isConnected && normalized.length > 0) {
			this.sendJson({ action: "unsubscribe", symbols: normalized });
		}
	}

	/** Register a callback for `ticker_update` events. */
	setOnTickerUpdate(cb: ((event: TickerUpdateEvent) => void) | null): void {
		this.onTickerUpdateCb = cb;
	}

	/** Register a callback for `whale_alert` events. */
	setOnWhaleAlert(cb: ((event: WhaleAlertWSEvent) => void) | null): void {
		this.onWhaleAlertCb = cb;
	}

	/** Permanently close the connection and prevent any reconnects. */
	destroy(): void {
		this._destroyed = true;
		if (this.reconnectTimer !== null) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		if (this.ws !== null) {
			this.ws.onclose = null;
			this.ws.onmessage = null;
			this.ws.onerror = null;
			this.ws.onopen = null;
			try {
				this.ws.close(1000, "destroy");
			} catch {
				// ignore
			}
			this.ws = null;
		}
		this._isConnected = false;
	}

	private handleRawMessage(data: string): void {
		let parsed: VNIWSEvent;
		try {
			parsed = JSON.parse(data) as VNIWSEvent;
		} catch {
			return;
		}
		if (parsed.event_type === "ticker_update") {
			this.onTickerUpdateCb?.(parsed as TickerUpdateEvent);
		} else if (parsed.event_type === "whale_alert") {
			this.onWhaleAlertCb?.(parsed as WhaleAlertWSEvent);
		}
	}

	private scheduleReconnect(): void {
		if (this._destroyed || this.wsUnavailable || this.reconnectAttempts >= VNInvestWebSocketClient.MAX_RECONNECT_ATTEMPTS) {
			return;
		}
		this.reconnectAttempts += 1;
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			if (!this._destroyed) {
				this.connect();
			}
		}, VNInvestWebSocketClient.RECONNECT_DELAY_MS);
	}

	private sendJson(msg: object): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(msg));
		}
	}
}
