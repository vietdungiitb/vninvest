/**
 * Bóc token cursor từ `next` mà BE trả về.
 *
 * BE trả `next` là URL đầy đủ (`?cursor=...`), nhưng query feed chỉ nhận token
 * cursor trần — gửi nguyên URL gây 404 "Invalid cursor" khi bấm "Trang sau".
 *
 * ## SSOT — trước đây có 2 bản trùng lặp, và chúng **khác nhau về hành vi**
 *
 * | Bản | `catch` trả về | Hậu quả |
 * |---|---|---|
 * | `useAlertCenterSnapshot.ts` (đã xoá) | `next` | gửi **lại chính URL hỏng** → BE 400/404 |
 * | `AlertCenterPage.tsx` (đã gộp vào đây) | `null` | không có cursor ⇒ dừng phân trang |
 *
 * Giữ bản **fail-closed** (`null`): `next` hỏng nghĩa là không có cursor hợp lệ.
 * Dừng phân trang còn hơn bắn một chuỗi bậy lên BE rồi nhận 400.
 */
export function extractFeedCursor(next: unknown): string | null {
  if (typeof next !== "string" || !next) return null;
  // Đã là token trần → dùng nguyên.
  if (!next.includes("cursor=")) return next;
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
    return new URL(next, base).searchParams.get("cursor");
  } catch {
    return null;
  }
}
