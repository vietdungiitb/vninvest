import { describe, it, expect } from "vitest";
import { extractFeedCursor } from "./feedCursor";

// Bảo vệ bug 404 "Invalid cursor": BE trả `next` là URL đầy đủ, feed query
// chỉ nhận token trần. Trước khi tách SSOT, logic này tồn tại ở 2 nơi với
// 2 fallback khác nhau — xem `feedCursor.ts`.
describe("extractFeedCursor", () => {
  it("bóc token từ next URL đầy đủ của BE (fix 404 Invalid cursor)", () => {
    expect(
      extractFeedCursor(
        "https://localhost/core/v1/signals/alert-center/feed?page_size=20&cursor=c2abc"
      )
    ).toBe("c2abc");
  });

  it("bóc được cả URL tương đối", () => {
    expect(extractFeedCursor("/core/v1/signals/alert-center/feed?cursor=c9z")).toBe("c9z");
  });

  it("giữ nguyên khi next đã là token trần", () => {
    expect(extractFeedCursor("c2abc")).toBe("c2abc");
  });

  it("null khi next rỗng / không phải chuỗi", () => {
    expect(extractFeedCursor(null)).toBeNull();
    expect(extractFeedCursor(undefined)).toBeNull();
    expect(extractFeedCursor("")).toBeNull();
    expect(extractFeedCursor(42)).toBeNull();
  });

  it("fail-closed khi URL hỏng: trả null chứ KHÔNG trả lại URL", () => {
    // Đây là khác biệt giữa bản cũ của hook (trả `next`) và bản của
    // AlertCenterPage (trả `null`). Giữ `null`: gửi lại URL hỏng chỉ tạo 400.
    //
    // Phải là URL hỏng **có** `cursor=` — nếu không có, hàm short-circuit ở
    // nhánh "đã là token trần" và trả nguyên chuỗi, không đi vào `catch`.
    expect(extractFeedCursor("http://[/feed?cursor=abc")).toBeNull();
    expect(extractFeedCursor("http://:80:80/?cursor=abc")).toBeNull();
    expect(extractFeedCursor("http://a b/?cursor=abc")).toBeNull();
  });

  it("URL tương đối lạ vẫn bóc được cursor thay vì ném lỗi", () => {
    expect(extractFeedCursor("::::?cursor=abc")).toBe("abc");
  });
});
