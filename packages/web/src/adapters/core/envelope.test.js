/**
 * B3 — hợp đồng của `unwrapEnvelope`.
 *
 * Test này là **ranh giới an toàn** của việc bọc `{data, meta}` ở backend. Nếu
 * một test ở đây đổi từ xanh sang đỏ, nghĩa là bọc envelope sẽ phá một trong các
 * họ đang chạy — chứ không phải "chi tiết cập nhật".
 *
 * Ba họ dưới đây tồn tại **thật** trong codebase (đo ở `4717fc1e`):
 *   - F3: `{status, timestamp, request_id, data}` — 12 call site
 *   - F5: `{data, +siblings}`                  —  3 call site
 *   - F1: mảng trần                           — 20 call site
 * Chúng đều có `data` **hoặc** không có `meta`, nên phải đi qua nguyên vẹn.
 *
 * Runner là **jest**, không phải vitest: `jest.config.js` chỉ ignore
 * `*.component.test.*` (những cái đó mới thuộc vitest — `vitest.config.ts`
 * include `src` + `*.component.test.*`). Test trong `src/adapters/` đi qua
 * `npm test` ⇒ jest. Import từ `"vitest"` sẽ làm jest không load được file này.
 *
 * Lưu ý khi sửa comment: **không** viết glob dạng `star-star-slash-star` trong
 * khối comment này — cặp `slash-star` đó kết thúc comment ngay giữa dòng và
 * làm jest báo `Unexpected token` ở một dòng trông vô hại.
 */
import { isEnvelope, unwrapEnvelope } from "./envelope.js";

describe("isEnvelope", () => {
  it("nhận diện đúng {data, meta}", () => {
    expect(isEnvelope({ data: { a: 1 }, meta: { as_of: "x" } })).toBe(true);
  });

  it("trả false với F3 {status, request_id, data} — không có meta", () => {
    const f3 = { status: "success", timestamp: "t", request_id: "r", data: { a: 1 } };
    expect(isEnvelope(f3)).toBe(false);
  });

  it("trả false với F5 {data, +siblings} — không có meta", () => {
    const f5 = { data: { a: 1 }, note: "full_analytics_available_via_sub_endpoints" };
    expect(isEnvelope(f5)).toBe(false);
  });

  it("trả false với payload phẳng", () => {
    expect(isEnvelope({ total_market_value: "0.00" })).toBe(false);
  });

  it("trả false với null / mảng / số / chuỗi", () => {
    expect(isEnvelope(null)).toBe(false);
    expect(isEnvelope(undefined)).toBe(false);
    expect(isEnvelope([1, 2])).toBe(false);
    expect(isEnvelope(0)).toBe(false);
    expect(isEnvelope("")).toBe(false);
  });
});

describe("unwrapEnvelope", () => {
  it("mở {data, meta} thành payload", () => {
    expect(unwrapEnvelope({ data: { nav: "10" }, meta: { as_of: "2026-09-30" } }))
      .toEqual({ nav: "10" });
  });

  it("GIỮ NGUYÊN F3 — có `data` nhưng không có `meta`", () => {
    // Nếu test này đỏ, unwrap sẽ nuốt `data` của toàn bộ 12 call site F3.
    const f3 = { status: "success", timestamp: "t", request_id: "r", data: { nav: "10" } };
    expect(unwrapEnvelope(f3)).toBe(f3);
  });

  it("GIỮ NGUYÊN F5 — không được làm rơi sibling", () => {
    const f5 = { data: { a: 1 }, note: "giữ tôi" };
    expect(unwrapEnvelope(f5)).toBe(f5);
  });

  it("GIỮ NGUYÊN payload phẳng (đường đọc hiện hành)", () => {
    const flat = { portfolio_id: 1, total_market_value: "0.00", nav: null };
    expect(unwrapEnvelope(flat)).toBe(flat);
  });

  it("GIỮ NGUYÊN mảng trần (F1)", () => {
    const arr = [{ symbol: "VCB", quantity: 100 }];
    expect(unwrapEnvelope(arr)).toBe(arr);
  });

  it("GIỮ NGUYÊN null — không được biến thành {} hay []", () => {
    // `Number(null) || 0` ra 0, còn `undefined || 0` cũng ra 0: cả hai đều là
    // "0 giả". Giữ nguyên `null` để component tự hiện "—" như SmartStatsHeader.
    expect(unwrapEnvelope(null)).toBe(null);
  });

  it("envelope có data=null vẫn phải mở, không trả nguyên cả object", () => {
    // Nếu lọc thêm bằng typeof, trường hợp này rơi vào tay component và
    // `x.nav` ra undefined thay vì null.
    expect(unwrapEnvelope({ data: null, meta: { as_of: null } })).toBe(null);
  });

  it("envelope có data=[] trả về mảng rỗng, không phải undefined", () => {
    expect(unwrapEnvelope({ data: [], meta: {} })).toEqual([]);
  });

  it("meta rỗng vẫn là envelope — quy tắc là có key, không phải có nội dung", () => {
    expect(unwrapEnvelope({ data: { a: 1 }, meta: {} })).toEqual({ a: 1 });
  });
});
