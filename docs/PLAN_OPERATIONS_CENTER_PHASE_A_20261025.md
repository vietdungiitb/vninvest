# PLAN — Operations Center Phase A (Correctness/UX, P0)

**Ngày:** 2026-10-25  
**Master:** `docs/PLAN_OPERATIONS_CENTER_MASTER_20261025.md`

## A1. Unify tab router

**Files:**
- `packages/web/src/pages/admin/ShellOperationsCenterPage.tsx`

**Hiện trạng:** `activeTab` init 1 lần; URL + localStorage race.  
**Thay đổi:**
- Dùng `useSearchParams` làm source of truth.
- `activeTab = searchParams.get("tab") || "overview"`.
- `handleTabChange` chỉ `setSearchParams({tab})`, không localStorage.
- Remove `STORAGE_KEY` usage.

**Acceptance (Given/When/Then):**
- Given URL `?tab=dataops`, When load page, Then activeTab=dataops.
- Given click tab signals, When URL update, Then activeTab=signals.
- Given back button, When URL changes, Then activeTab sync.

**Test:** component test deep-link/back-forward.

## A2. I18n hardcode labels

**Files:**
- `ShellOperationsCenterPage.tsx`
- `packages/web/src/i18n/vi.js`
- `packages/web/src/i18n/en.js`

**Thay đổi:** replace `"OPERATIONS CENTER"`, `"LIVE"` with `t("soc.pages.operations_center_eyebrow")`, `t("soc.pages.live")`.

**Risk:** i18n files có claim in-progress; chỉ thêm key, không sửa key cũ.

## A3. DataOps visibility-aware polling

**Files:**
- `packages/web/src/components/soc/DataOpsContext.tsx`

**Thay đổi:**
- Thêm `refreshAll()` = inventory+runs+coverage+config.
- `setInterval` khi document visible; pause khi hidden.
- Cleanup on unmount.
- Poll 15s khi active.

**Acceptance:** unmount clears interval; hidden pauses; visible resumes.

## A4. Signals live feed mode

**Files:**
- `packages/web/src/components/soc/SocSignalsPanel.tsx`
- `packages/web/src/hooks/useSignalStream.ts`

**Thay đổi:**
- Thêm toggle “Snapshot / Live”.
- Live mode dùng stream URL + reconnect/backoff.
- Snapshot mode fetch 1 lần.

**Acceptance:** toggle switches data source; no duplicate fetch in snapshot.

## Gates

- `npx tsc --noEmit` PASS.
- Component tests PASS (targeted).  
- BE/VPS tests: CHƯA CHẠY nếu không có môi trường.