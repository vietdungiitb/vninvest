/**
 * B3 — mở payload `{data, meta}` ở **biên HTTP**, theo hình dạng chứ không theo
 * giả định.
 *
 * ## Vì sao không được unwrap mù
 *
 * Trong FE có **15 chỗ `.data` KHÔNG phải envelope**:
 *   - `useQuery` của react-query tạo `.data` riêng
 *   - `params.data` của echarts
 *   - payload lỗi của axios
 *
 * Nếu đặt `unwrap` ở chỗ khác (trong component, hoặc một helper dùng chung) thì
 * nó sẽ nuốt luôn `.data` của react-query. Đó là lý do helper này **chỉ** được
 * gọi ở 5 điểm thoát payload của `transport.js` — nơi body vừa được parse ra
 * từ HTTP. `.data` của react-query không đi qua đó nên **không thể** bị đụng,
 * theo cấu trúc chứ không theo kỷ luật.
 *
 * ## Vì sao điều kiện là `data` **và** `meta`
 *
 * Đo được trên `4717fc1e`: `{data, meta}` có **0 call site**. Trong 10 họ
 * envelope đang tồn tại:
 *   - F3 `{status, timestamp, request_id, data}` — có `data` nhưng **không** có `meta`
 *   - F5 `{data, +siblings}` — có `data` nhưng **không** có `meta`
 *
 * Nên "có cả hai key" là điều kiện **không nhập nhằng**: không họ nào đang
 * chạy có cặp `data`+`meta`, nên unwrap không thể phá nhầm. Chỉ cần thêm một
 * họ mới thì mới cần xét lại.
 *
 * @param {unknown} payload body vừa parse từ HTTP
 * @returns {unknown} payload đã mở, hoặc chính `payload` nếu không phải envelope
 */
export function unwrapEnvelope(payload) {
  if (!isEnvelope(payload)) return payload;
  return payload.data;
}

/**
 * Có phải envelope `{data, meta}` không?
 *
 * Cố ý **không** dùng `&& typeof payload.data === 'object'`: `data` rỗng vẫn là
 * envelope hợp lệ (payload lúc đó rỗng), và nếu lọc bằng kiểu dữ liệu thì sẽ
 * trả `{data: null, meta: {...}}` nguyên vẹn ⇒ component đọc `x.foo` và nhận
 * `undefined` ở chỗ lẽ ra là `null` đã biết là "chưa có dữ liệu".
 *
 * @param {unknown} payload
 * @returns {boolean}
 */
export function isEnvelope(payload) {
  if (payload === null || typeof payload !== "object") return false;
  if (Array.isArray(payload)) return false;
  return "data" in payload && "meta" in payload;
}
