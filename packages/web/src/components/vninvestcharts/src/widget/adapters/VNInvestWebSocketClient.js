/**
 * WP-03: VNInvestWebSocketClient — moved from src/demo/dataSources/
 * WebSocket client for the VNInvest Realtime channel.
 */
import { resolveApiBase } from "./VNInvestClient.js";
export class VNInvestWebSocketClient {
    static MAX_RECONNECT_ATTEMPTS = 5;
    static RECONNECT_DELAY_MS = 5000;
    static WS_PATH_CANDIDATES = ["/ws/realtime/", "/api/realtime/ws/"];
    ws = null;
    pat;
    apiBase;
    selectedWsPath = null;
    wsUnavailable = false;
    wsProbePromise = null;
    subscribedSymbols = new Set();
    onTickerUpdateCb = null;
    onWhaleAlertCb = null;
    reconnectTimer = null;
    reconnectAttempts = 0;
    _isConnected = false;
    _destroyed = false;
    constructor(pat, apiBase = resolveApiBase()) {
        this.pat = pat;
        this.apiBase = apiBase;
    }
    get isConnected() {
        return this._isConnected;
    }
    get destroyed() {
        return this._destroyed;
    }
    buildWsUrl(path = "/ws/realtime/") {
        const wsBase = this.apiBase
            .replace(/^https:\/\//, "wss://")
            .replace(/^http:\/\//, "ws://")
            .replace(/\/$/, "");
        return `${wsBase}${path}?token=${encodeURIComponent(this.pat)}`;
    }
    buildHttpProbeUrl(path) {
        const httpBase = this.apiBase.replace(/\/$/, "");
        return `${httpBase}${path}`;
    }
    async probeWsPath(path) {
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
        }
        catch {
            return false;
        }
    }
    async resolveWsPath() {
        if (this.selectedWsPath) {
            return this.selectedWsPath;
        }
        try {
            const hostname = new URL(this.apiBase).hostname;
            if (hostname.endsWith(".test")) {
                this.selectedWsPath = VNInvestWebSocketClient.WS_PATH_CANDIDATES[0];
                return this.selectedWsPath;
            }
        }
        catch {
            // ignore
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
    connect() {
        if (this._destroyed || this.ws !== null || this.wsUnavailable) {
            return;
        }
        void this.openConnection();
    }
    async openConnection() {
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
        }
        catch {
            this.scheduleReconnect();
            return;
        }
        this.ws.onopen = () => {
            this.reconnectAttempts = 0;
            this._isConnected = true;
            const symbols = Array.from(this.subscribedSymbols);
            if (symbols.length > 0) {
                this.sendJson({ action: "subscribe", symbols });
            }
        };
        this.ws.onmessage = (event) => {
            this.handleRawMessage(event.data);
        };
        this.ws.onclose = (event) => {
            this.ws = null;
            this._isConnected = false;
            if (event.code === 4401) {
                return;
            }
            this.scheduleReconnect();
        };
        this.ws.onerror = () => {
            // handled in onclose
        };
    }
    subscribe(symbols) {
        const normalized = symbols.map((s) => s.trim().toUpperCase()).filter(Boolean);
        for (const sym of normalized) {
            this.subscribedSymbols.add(sym);
        }
        if (this._isConnected && normalized.length > 0) {
            this.sendJson({ action: "subscribe", symbols: normalized });
        }
    }
    unsubscribe(symbols) {
        const normalized = symbols.map((s) => s.trim().toUpperCase()).filter(Boolean);
        for (const sym of normalized) {
            this.subscribedSymbols.delete(sym);
        }
        if (this._isConnected && normalized.length > 0) {
            this.sendJson({ action: "unsubscribe", symbols: normalized });
        }
    }
    setOnTickerUpdate(cb) {
        this.onTickerUpdateCb = cb;
    }
    setOnWhaleAlert(cb) {
        this.onWhaleAlertCb = cb;
    }
    destroy() {
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
            }
            catch {
                // ignore
            }
            this.ws = null;
        }
        this._isConnected = false;
    }
    handleRawMessage(data) {
        let parsed;
        try {
            parsed = JSON.parse(data);
        }
        catch {
            return;
        }
        if (parsed.event_type === "ticker_update") {
            this.onTickerUpdateCb?.(parsed);
        }
        else if (parsed.event_type === "whale_alert") {
            this.onWhaleAlertCb?.(parsed);
        }
    }
    scheduleReconnect() {
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
    sendJson(msg) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }
}
