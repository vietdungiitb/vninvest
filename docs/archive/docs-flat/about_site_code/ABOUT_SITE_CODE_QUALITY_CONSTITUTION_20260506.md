# CODE QUALITY CONSTITUTION — About Site: VNInvest Ecosystem Hub

**Ngày**: 2026-05-06  
**Mục tiêu**: quy tắc chất lượng để about site không biến thành landing page đẹp nhưng không đáng tin.

---

## 1. Purpose

Chất lượng của about site không được định nghĩa bằng việc “đẹp mắt” בלבד. Chất lượng ở đây nghĩa là:

1. `/chart` phải chứng minh được VNBrokerCharts là chart engine thật, không phải demo dán ngoài.
2. `/vnbroker/playground` phải chạy code trong browser sandbox, không phải server sandbox.
3. Người dùng phải đọc được nội dung tiếng Việt đầy đủ dấu ở mọi trang public.
4. Mọi data relay phải có whitelist, rate limit và cache header rõ ràng.
5. SEO, metadata, sitemap và legal pages phải đủ để site có thể public thật.

---

## 2. Non-negotiable principles

1. **Single source of truth cho chart demo**
   - `vnbrokercharts` là engine hiển thị chart.
   - About site chỉ wrap và consume, không reimplement chart logic.

2. **Browser-only execution cho Pyodide**
   - playground chỉ chạy trong browser.
   - không có server exec, không tạo API chạy code tuỳ ý.

3. **Relay-only public data access**
   - browser không chạm trực tiếp backend host.
   - route handlers chịu trách nhiệm whitelist + rate limit + cache.

4. **i18n trước hardcode**
   - text user-facing mới phải đi qua `vi.json` và `en.json`.
   - tiếng Việt là default và phải có dấu đầy đủ.

5. **SEO và public shareability**
   - mỗi route public phải có metadata hợp lệ.
   - blog và legal pages phải index được khi cần.

6. **Visual quality with restraint**
   - UI phải sắc nét và có ý đồ.
   - tránh layout “boilerplate SaaS” quá an toàn.
   - ưu tiên editorial hero, rõ hierarchy, ít rối.

7. **No secret leakage**
   - không lộ backend URL nội bộ trong bundle client.
   - không hardcode token, key, or private endpoint.

8. **Deployability**
   - mọi slice phải build được trong container.
   - production image không source-mount, không runtime install.

---

## 3. Coverage targets

| Subsystem | Target | Why |
|---|---:|---|
| Locale shell and copy | 100% | public copy là mặt tiền site |
| Chart relay and validation | 95% | chart demo là flagship surface |
| Pyodide playground | 95% | nếu sandbox sai sẽ thành rủi ro lớn |
| Blog / SEO | 90% | ảnh hưởng discoverability |
| Deploy and health | 95% | cần smoke test production |

---

## 4. Coverage theater prevention

Các thứ sau không được tính là bằng chứng chất lượng:

1. Chỉ có `npm run build` pass mà không có screenshot.
2. Chỉ có screenshot mà không có payload hoặc curl proof.
3. Chỉ nói “đã dùng VNBrokerCharts” nhưng chart page vẫn import wrapper cũ.
4. Chỉ test valid symbol mà không test invalid symbol và rate limit.
5. Chỉ test Pyodide load thành công mà không test code sample thực thi được.
6. Chỉ test blog route mà không test metadata/ISR.

---

## 5. Mandatory review questions

Khi review diff, phải trả lời rõ:
1. Có route nào public còn fetch trực tiếp backend từ client không?
2. Có string user-facing nào chưa qua i18n không?
3. `/chart` có thật sự render `vnbrokercharts` không?
4. Symbol allowlist có được áp dụng ở mọi relay route không?
5. Có header CSP hoặc cache nào bị thiếu ở route công khai không?
6. Build image có chạy được mà không cần source mount hay runtime install không?

---

## 6. Done definition

About site chỉ được gọi là done khi:
- domain public trả 200,
- VI/EN toggle đúng,
- chart demo dùng `vnbrokercharts`,
- playground chạy trong browser,
- SEO và blog hoạt động,
- deploy production khỏe,
- audit ledger và progress dashboard đã được cập nhật,
- và residual risk được ghi rõ.
