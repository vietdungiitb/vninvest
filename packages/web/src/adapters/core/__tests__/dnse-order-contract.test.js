import { jest } from '@jest/globals';
import { createWorkspaceClient } from "../workspace.js";

/**
 * PA-5 — contract DNSE order giữa FE và BE.
 *
 * BE `views_dnse.py` fail-closed từ SAFE-01: `mode` bắt buộc trong body và
 * `Idempotency-Key` bắt buộc là HEADER cho cả 3 endpoint. Trước PA-5, FE gửi
 * không field nào ⇒ mọi lệnh từ UI trả 400 (`order_mode_required` /
 * `idempotency_key_required`). Test này khoá lại contract đó.
 *
 * Lưu ý: `transport.js` thuộc `tenantreg-e` nên PA-5 chỉ dựa vào sự thật đã
 * kiểm chứng: `corePost(path, body, options)` spread `options` vào fetchOptions
 * và `requestWithAuth` merge `...(init.headers || {})`.
 */
describe("DNSE order contract (PA-5)", () => {
  let coreGet;
  let corePost;
  let corePut;
  let corePatch;
  let coreDelete;
  let ws;

  const validOrder = {
    trading_token: "tok-123",
    payload: { symbol: "VCB", side: "buy", price: 52000, quantity: 100 },
  };

  beforeEach(() => {
    coreGet = jest.fn().mockResolvedValue({});
    corePost = jest.fn().mockResolvedValue({ result: { order_id: "X-1" } });
    corePut = jest.fn().mockResolvedValue({});
    corePatch = jest.fn().mockResolvedValue({});
    coreDelete = jest.fn().mockResolvedValue({});
    ws = createWorkspaceClient({ coreGet, corePost, corePut, corePatch, coreDelete });
  });

  describe("placeDNSEOrder", () => {
    it("mac dinh mode=paper khi caller khong truyen mode", async () => {
      await ws.placeDNSEOrder(validOrder);
      expect(corePost.mock.calls[0][1].mode).toBe("paper");
    });

    it("gui Idempotency-Key trong HEADER chứ không phải body", async () => {
      await ws.placeDNSEOrder(validOrder);
      const [, body, options] = corePost.mock.calls[0];
      expect(options.headers["Idempotency-Key"]).toBeTruthy();
      expect(body).not.toHaveProperty("Idempotency-Key");
      expect(body).not.toHaveProperty("idempotency_key");
    });

    it("sinh Idempotency-Key moi cho moi lan submit", async () => {
      await ws.placeDNSEOrder(validOrder);
      await ws.placeDNSEOrder(validOrder);
      const first = corePost.mock.calls[0][2].headers["Idempotency-Key"];
      const second = corePost.mock.calls[1][2].headers["Idempotency-Key"];
      expect(first).not.toBe(second);
    });

    it("cho phep caller truyen idempotencyKey de replay co chu dich", async () => {
      await ws.placeDNSEOrder(validOrder, { idempotencyKey: "fixed-key-1" });
      expect(corePost.mock.calls[0][2].headers["Idempotency-Key"]).toBe("fixed-key-1");
    });

    it("trang thai paper duoc gui xuong BE", async () => {
      await ws.placeDNSEOrder({ ...validOrder, mode: "paper" });
      expect(corePost.mock.calls[0][1].mode).toBe("paper");
    });

    it("tu default market_type/order_category khi caller khong truyen", async () => {
      await ws.placeDNSEOrder(validOrder);
      const body = corePost.mock.calls[0][1];
      expect(body.market_type).toBe("STOCK");
      expect(body.order_category).toBe("NORMAL");
    });

    it("mode sai gia tri thi nem loi TRUOC khi goi mang", () => {
      // Validate đồng bộ để fail-fast: không tốn request lên BE.
      expect(() => ws.placeDNSEOrder({ ...validOrder, mode: "bogus" })).toThrow(/mode/);
      expect(corePost).not.toHaveBeenCalled();
    });

    it("mode null/undefined khong duoc bo qua — mac dinh paper", async () => {
      await ws.placeDNSEOrder({ ...validOrder, mode: undefined });
      expect(corePost.mock.calls[0][1].mode).toBe("paper");
    });

    it("mode rong string cung duoc mac dinh paper", async () => {
      await ws.placeDNSEOrder({ ...validOrder, mode: "" });
      expect(corePost.mock.calls[0][1].mode).toBe("paper");
    });

    it("thieu trading_token thi nem loi va khong goi mang", () => {
      expect(() => ws.placeDNSEOrder({ payload: {} })).toThrow(/trading_token/);
      expect(corePost).not.toHaveBeenCalled();
    });

    it("payload khong phai object thi nem loi va khong goi mang", () => {
      expect(() => ws.placeDNSEOrder({ trading_token: "t" })).toThrow(/payload/);
      expect(corePost).not.toHaveBeenCalled();
    });

    it("khong con gui dry_run — BE da tu choi boolean nay", async () => {
      await ws.placeDNSEOrder(validOrder);
      expect(corePost.mock.calls[0][1]).not.toHaveProperty("dry_run");
    });
  });

  describe("OTP + trading token cung fail-closed", () => {
    it("sendDNSEEmailOtp mac dinh mode=paper", async () => {
      await ws.sendDNSEEmailOtp();
      expect(corePost).toHaveBeenCalledWith(
        "/broker/dnse/send-email-otp/",
        expect.objectContaining({ mode: "paper" }),
      );
    });

    it("createDNSETradingToken mac dinh mode=paper", async () => {
      await ws.createDNSETradingToken({ passcode: "123456" });
      expect(corePost).toHaveBeenCalledWith(
        "/broker/dnse/create-trading-token/",
        expect.objectContaining({ mode: "paper" }),
      );
    });

    it("createDNSETradingToken giu nguyen otp_type va passcode", async () => {
      await ws.createDNSETradingToken({ otp_type: "EMAIL", passcode: "123456" });
      const body = corePost.mock.calls[0][1];
      expect(body.otp_type).toBe("EMAIL");
      expect(body.passcode).toBe("123456");
    });

    it("thieu passcode thi nem loi va khong goi mang", () => {
      expect(() => ws.createDNSETradingToken({})).toThrow(/passcode/);
      expect(corePost).not.toHaveBeenCalled();
    });
  });
});
