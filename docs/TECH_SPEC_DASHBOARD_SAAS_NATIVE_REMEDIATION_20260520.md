# TECHNICAL SPECIFICATION — Dashboard SaaS Native Remediation

**Ngày**: 2026-05-20  
**Tác giả**: Antigravity  
**Trạng thái**: Hardened (Vòng 2) / Đã gia cố toàn diện chống regression  
**Phạm vi**: `@vninvest/web` package (`../packages/web/src/pages/DashboardPage.js` & `../packages/web/src/features/dashboard/useCoreDashboardData.js`) và `PackageDashboardHost.jsx`.

---

## 1. Bối cảnh & Mục tiêu kỹ thuật
Để hoàn thành quá trình chuyển đổi (cutover) từ giao diện cũ `ModernDashboard` sang giao diện SaaS-Native chuẩn **`PackageDashboardHost` $\rightarrow$ `DashboardPage`**, chúng ta thực hiện rà soát nghiêm ngặt kiến trúc **JSX-Free** (React `createElement`), loại bỏ WebSocket churn và đảm bảo khả năng cô lập lỗi.

---

## 2. Thiết kế chi tiết cho từng Slice công việc

### Slice 1: Phase 2 Technicals Isolation & Degraded-State Contract
* **Giải pháp:** Cô lập Phase 2 bằng `try-catch` cục bộ. Bổ sung trạng thái degraded-state trực quan `technicalsStatus`.
* **Chuẩn hóa Forensic Error Code (Bảng mã lỗi DataOps):**
  - `[ERR_CORE_PORTFOLIO_SUMMARY_01]`: Lỗi sập Phase 1 khi nạp portfolio summary. (Critical - Sập trang).
  - `[ERR_CORE_PORTFOLIO_HOLDINGS_02]`: Lỗi sập Phase 1 khi nạp holdings. (Critical - Sập trang).
  - `[ERR_CORE_BULK_TECHNICAL_03]`: Lỗi degraded Phase 2 khi API bulk technicals lỗi/timeout 504. (Non-Critical - Chỉ log degraded, holdings vẫn hiển thị, gán `technicals = []`).

---

### Slice 2: Stable Ready Token & WebSocket Churn Prevention
* **Giải pháp:** Áp dụng công thức `readyToken` chuẩn hóa (Set Semantics: Deduplicate + Sort Alphabetically + Stable Serializer), bao phủ đầy đủ cả nguồn **watchlists** độc lập để tránh bỏ sót trigger realtime.
* **Công thức Stable Ready Token cải tiến:**
  ```javascript
  const collectUniqueSortedSymbols = (holdings, trackedSymbols, watchlists, watchlistGroups) => {
    const rawList = [
      ...(holdings || []).map(h => h?.symbol),
      ...(trackedSymbols || []).map(s => s?.symbol),
      ...(watchlists || []).flatMap(w => (w?.items || []).map(i => i?.symbol)),
      ...(watchlistGroups || []).flatMap(g => (g?.items || []).map(i => i?.symbol))
    ];
    
    // Normalization, Deduplication và Alphabetical Sorting
    const uniqueSorted = Array.from(
      new Set(rawList.map(s => String(s || "").trim().toUpperCase()).filter(Boolean))
    ).sort();
    
    return uniqueSorted.join("|");
  };
  ```

---

### Slice 3: Anti-Flicker Skeleton (hasHydrated UX Lifecycle)
* **Giải pháp:** Sử dụng cờ trạng thái **`hasHydrated`** (mặc định `false`) trong hook `useCoreDashboardData`.
  - Khởi tạo lần đầu: `hasHydrated = false`, hiển thị skeleton.
  - Khi đợt tải Phase 1 đầu tiên kết thúc (dù danh mục trống): `hasHydrated = true`.
  - Polling/refresh ngầm tiếp theo: Không vẽ đè skeleton (Stale-While-Revalidate).

---

### Slice 4: Selected Session Unification Contract & Phased Delivery Gates
* **Định hình 2 Pha triển khai:**
  * **Pha A (Định hình Contract):** Thiết lập state `selectedSession` và `selectedSymbol` ở container `DashboardPage.js` và `PackageDashboardHost.jsx`, ánh xạ qua render slots.
  * **Pha B (Hiện thực hóa Component):** Cập nhật props của `AIAdvisorAlertPanel.jsx`, `UnifiedAlertCenter.jsx` và `FactsFirstModularPositionDeck.jsx` để tiếp nhận và phản hồi tương tác click.
* **Tiêu chí nghiệm thu (Delivery Gates):**
  * **Pha A Pass:** Giao diện container và Host nhận, chuyển tiếp các session state/handler qua slots thành công, build không lỗi, layout không vỡ.
  * **Pha B Pass:** Tương tác click KLine đồng bộ thành công AI Panel và Alert Lane thời gian thực.
  * **Rollback Condition:** Nếu kết thúc Milestone mà Pha B chưa sẵn sàng hoặc gây regression, ta lập tức revert code Pha A hoặc tắt cờ liên kết chéo ở Host Shell để bảo toàn tính độc lập của trang.

---

### Slice 5: i18n Package Isolation (Dependency Inversion)
* **Giải pháp:** Nhận prop `t` (bộ dịch) được Host Shell truyền (inject) trực tiếp xuống `DashboardPage.js`:
  ```javascript
  export function DashboardPage({
    t = (key, defaultText) => defaultText, // Injected translation helper
    // ...
  })
  ```

---

## 3. Quy trình Kiểm thử UI Lifecycle chuyên sâu (Slice 6)
Bộ kiểm thử tự động sẽ được tạo mới tại đường dẫn `../packages/web/src/features/dashboard/__tests__/dashboard_lifecycle.test.js` kiểm soát 4 ca test trọng điểm (Phase 2 fail, Empty holdings trigger, SWR anti-flicker, WebSocket stable token).
