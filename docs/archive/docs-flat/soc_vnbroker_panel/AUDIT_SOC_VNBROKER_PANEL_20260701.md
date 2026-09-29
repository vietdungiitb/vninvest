# Audit Report: SOC VNBroker Tab UI/UX & Technical Gaps

**Auditor:** Antigravity AI  
**Date:** July 1, 2026  
**Target:** Operations Center - VNBroker Tab (`SocVnbrokerPanel.tsx` & corresponding backend integration)  
**Status:** COMPLETE (Direct codebase inspection)

---

## Executive Summary
An audit of the VNBroker management panel under the Operations Center reveals significant functional and UI/UX gaps. Key operations defined in the backend API (such as connection testing and circuit breaker monitoring) are completely omitted from the user interface. Additionally, configuration previews bypass backend validation in favor of client-side diffs, and the benchmark tables lack the visual polish and micro-interactions of other modern components in the suite.

---

## Feature & Functional Gaps

### 1. Bypassed Server-Side Preview Validation
* **File:** [SocVnbrokerPanel.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/soc/SocVnbrokerPanel.tsx#L100-L107)
* **Code Proof:**
  ```typescript
  const handlePreview = () => {
    try {
      const parsed = JSON.parse(editConfig) as VnbrokerConfig;
      setPreviewModal({ before: config || {}, after: parsed }); // Local client-side diff only
    } catch {
      alert(t("soc.vnbroker.invalid_json"));
    }
  };
  ```
* **Gap:** The backend adapter exposes a dedicated preview endpoint `previewSocVnbrokerConfig` (POST `/operator/soc/vnbroker/config/preview/`), but the panel bypasses it. By comparing configuration diffs purely on the client side, the application loses the benefit of server-side schema verification, credential checking, and connection pre-flight testing.

---

### 2. Missing Circuit Breaker Status UI
* **File:** Not referenced in `SocVnbrokerPanel.tsx`
* **Adapter Method:** `getSocVnbrokerCircuitBreaker()` (GET `/operator/soc/vnbroker/circuit-breaker-status/`)
* **Gap:** The circuit breaker is a critical safeguard that isolates failing market data providers. Because the circuit breaker status is completely missing from the UI, operators cannot verify if the breaker is `CLOSED`, `HALF-OPEN`, or `TRIPPED`, leaving them blind during API outages.

---

### 3. Missing Connection Testing Interface
* **File:** Not referenced in `SocVnbrokerPanel.tsx`
* **Adapter Method:** `testSocVnbrokerConnection()` (POST `/operator/soc/vnbroker/test-connection/`)
* **Gap:** The backend supports manual connection diagnostics, but the panel provides no button to trigger a connection test. Operators cannot verify if credentials and endpoint handshakes are working after changing settings without waiting for background jobs to fail.

---

## UI/UX & Styling Gaps

### 1. Basic HTML Table Layout for Benchmark Results
* **File:** [SocVnbrokerPanel.tsx:L254-280](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/soc/SocVnbrokerPanel.tsx#L254-L280)
* **Gap:** The benchmark results section renders a plain table using standard borders (`1px solid var(--border-default)`) with no row-hover states, no glassmorphism backdrop classes, and basic typography. This contrasts with the premium grids and accordion metrics implemented in other areas (such as the DataOps inventory grid).

### 2. Absence of Color-Coded Performance Badges
* **File:** [SocVnbrokerPanel.tsx:L268-277](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/soc/SocVnbrokerPanel.tsx#L268-L277)
* **Gap:** Metrics such as `success_rate` (e.g. 100%) and `rate_limit_pct` are displayed as raw strings. The UI should use standard status color tokens to clearly highlight degraded performance:
  - Green badge/pill for 100% success rate.
  - Amber badge/pill for 90% - 99% success rate.
  - Red badge/pill for < 90% success rate or elevated rate limiting.

### 3. Static Provider Cards
* **File:** [SocVnbrokerPanel.tsx:L285-300](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/soc/SocVnbrokerPanel.tsx#L285-L300)
* **Gap:** The provider list only displays status badges (`healthy`/`degraded`/`unhealthy`). The cards are completely static and lack interactive hover states or contextual details like credentials active flags.

---

## Proposed Remediation Plan

1. **Implement Circuit Breaker Status Badge**: Add a dedicated status widget next to the Provider health card group to show active breaker status (Tripped vs Closed).
2. **Add Connection Diagnostics Action**: Add a "Test Connection" button inside the configuration card that calls `testSocVnbrokerConnection` and displays success/error banners inline.
3. **Refactor Preview Flow to use Server Validation**: Update `handlePreview` to send the parsed payload to `previewSocVnbrokerConfig` and present the server's validation report in the preview modal.
4. **Upgrade Table Styling**: Wrap the benchmark table inside glassmorphism tokens, and apply dynamic colors and status pills to the success and rate-limit columns.
