import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { PATTokenModal } from "../components/PATTokenModal";
import { VNInvestClient } from "../dataSources/VNInvestClient";
const reactActEnvironment = globalThis;
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
function changeInputValue(input, value) {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
}
describe("PATTokenModal", () => {
    let container = null;
    let root = null;
    let client;
    beforeEach(() => {
        vi.stubGlobal("localStorage", {
            getItem: vi.fn().mockReturnValue(null),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        });
        document.documentElement.lang = "vi";
        client = new VNInvestClient();
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(async () => {
        await act(async () => {
            root?.unmount();
        });
        root = null;
        container?.remove();
        container = null;
        vi.unstubAllGlobals();
        document.documentElement.lang = "";
    });
    it("centralizes data source selection inside the PAT modal", async () => {
        const onClose = vi.fn();
        const onSaved = vi.fn();
        const onSourceChange = vi.fn();
        await act(async () => {
            root?.render(_jsx(PATTokenModal, { isOpen: true, client: client, activeSource: "binance", onSourceChange: onSourceChange, onClose: onClose, onSaved: onSaved }));
        });
        expect(container?.textContent).toContain("Offline");
        expect(container?.textContent).toContain("VNInvest");
        const sourceButtons = Array.from(container?.querySelectorAll(".gc-datasource-btn") ?? []);
        expect(sourceButtons).toHaveLength(3);
        await act(async () => {
            sourceButtons[2]?.click();
        });
        expect(onSourceChange).toHaveBeenCalledWith("vninvest");
    });
    it("opens on the requested login tab", async () => {
        const onClose = vi.fn();
        const onSaved = vi.fn();
        const onSourceChange = vi.fn();
        await act(async () => {
            root?.render(_jsx(PATTokenModal, { isOpen: true, client: client, activeSource: "vninvest", onSourceChange: onSourceChange, onClose: onClose, onSaved: onSaved, initialTab: "login" }));
        });
        expect(container?.querySelector("#gc-login-username")).not.toBeNull();
        expect(container?.textContent).toContain("Đăng nhập");
    });
    it("applies the typed API base when saving a PAT without requiring Set first", async () => {
        const onClose = vi.fn();
        const onSaved = vi.fn();
        const onSourceChange = vi.fn();
        const onConfigChange = vi.fn();
        await act(async () => {
            root?.render(_jsx(PATTokenModal, { isOpen: true, client: client, activeSource: "vninvest", onSourceChange: onSourceChange, onClose: onClose, onSaved: onSaved, onConfigChange: onConfigChange }));
        });
        const apiBaseInput = container?.querySelector("#gc-api-base-input");
        const patInput = container?.querySelector("#gc-pat-input");
        const saveButton = container?.querySelector(".gc-pat-tab__actions .gc-btn--primary");
        await act(async () => {
            changeInputValue(apiBaseInput, "http://127.0.0.1:8000/");
            changeInputValue(patInput, "vni_local_token");
            saveButton?.click();
        });
        expect(client.getBase()).toBe("http://127.0.0.1:8000");
        expect(client.getPAT()).toBe("vni_local_token");
        expect(onConfigChange).toHaveBeenCalledOnce();
        expect(onSaved).toHaveBeenCalledWith(true);
    });
    it("uses the typed API base for login without requiring Set first", async () => {
        const onClose = vi.fn();
        const onSaved = vi.fn();
        const onSourceChange = vi.fn();
        const onConfigChange = vi.fn();
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ access: "vni_login_token" }),
        });
        vi.stubGlobal("fetch", fetchMock);
        await act(async () => {
            root?.render(_jsx(PATTokenModal, { isOpen: true, client: client, activeSource: "vninvest", onSourceChange: onSourceChange, onClose: onClose, onSaved: onSaved, onConfigChange: onConfigChange, initialTab: "login" }));
        });
        const apiBaseInput = container?.querySelector("#gc-api-base-input");
        const usernameInput = container?.querySelector("#gc-login-username");
        const passwordInput = container?.querySelector("#gc-login-password");
        const loginButton = container?.querySelector(".gc-login-tab .gc-btn--primary");
        await act(async () => {
            changeInputValue(apiBaseInput, "http://127.0.0.1:9000/");
            changeInputValue(usernameInput, "demo");
            changeInputValue(passwordInput, "secret");
            loginButton?.click();
        });
        expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:9000/core/v1/auth/token/", expect.objectContaining({ method: "POST" }));
        expect(client.getBase()).toBe("http://127.0.0.1:9000");
        expect(client.getPAT()).toBe("vni_login_token");
        expect(onConfigChange).toHaveBeenCalledOnce();
        expect(onSaved).toHaveBeenCalledWith(true);
    });
});
