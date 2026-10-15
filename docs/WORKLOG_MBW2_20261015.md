# WORKLOG — Wave 2 Broker Hub UI: một chu trình khép kín (2026-10-15)

- **Nhánh tích hợp:** `feat/mbw2-broker-hub` → `dev` (1 PR cuối wave) · **Claim:** `mbw2-hub` + `mbw2-data` (done sau PR)
- **Lessons áp dụng:** [L-001, L-002, L-003, L-006, L-008, L-A01, L-G01, L-G02, L-G03, L-G04, L-G07, L-G08, L-V02, L-V03, L-F01, L-F03, L-F08, L-F09, L-F10, L-T01, L-T02] + TDD fail-before
- **Độ lệch khỏi plan (PM chốt, có lý do):** agent có nhánh riêng `feat/mbw2-hub`/`feat/mbw2-data` merge vào nhánh tích hợp (thay vì 2 worktree chung 1 nhánh — git cấm 2 worktree cùng checkout 1 branch); giữ nguyên "1 PR cuối wave".

## 1. Pha 0 — Claims + worktrees + junctions

- Nhánh tích hợp + 2 worktree (`C:/MujocoProjects/agent-mbw2-hub`, `.../agent-mbw2-data`) + junction node_modules (sửa path có dấu cách) + claims commit riêng trước dòng code đầu.
- File audit sót `PLAN_AUDIT_WAVE2` chưa commit ⇒ branch + PR #148 riêng, merged, cleanup.

## 2. Pha 1 — Song song (TDD fail-before + control cả 2)

- **HUB** (B2.1/B2.2/B2.6): route `/broker` + 3 tile + form schema-driven + redirect + menu + soc-css (chủ duy nhất). Fail-before ĐỎ import-fail, control route-catalog 3/3.
- **DATA** (B2.3/B2.4/B2.5 + adapter +10): 4 tab + Sync Center + holdings badge fail-closed. Fail-before 4 file ĐỎ, control portfolio 12/12.
- QĐ PM giữa pha: WIRING-01 (corePatch 1 dòng, owner DATA) · BE-01 (bindings PATCH-only ⇒ xoá helper GET, KNOWN GAP BE-READ Wave 3) · BE-02 (kind không expose ⇒ fail-closed, KNOWN GAP Wave 3) · thêm `getBrokerCapabilities`.
- GAP tích hợp: DATA components chưa mount vào route ⇒ HUB follow-up `/broker/accounts/:accountId` (mount nối tiếp, 0 sửa file DATA).

## 3. Pha 2 — Cross-review độc lập (2 vòng)

- Vòng 1: **1 blocker** (AC7 — `brokerHub:` trùng 2 lần/vi.js+en.js, runtime mất `data.*`) + 3 major (evidence 2 key sai tên; AC5 partial BE-02; gates cây cuối).
- Sửa: gộp 1 khối duy nhất + evidence tên thật + **RUNTIME-12/12** (node import locale thật). tsc 0, vitest 46/46.
- Vòng 2: **0 blocker + 0 major chưa chấp nhận** (AC5 partial đã chấp nhận + ticket; AC8 đóng bằng rebuild + rerun).
- B2.7: prefix tách đôi đúng; `routes.broker` ngoại lệ duy nhất; `check:i18n-hardcoded` không viện dẫn (pass rỗng).
- Bundle: BrokerHubPage 1355.1 KB + BrokerAccountPage 1350.7 KB ≤ 1450 KB; 0 echarts/xlsx. Dead-link grep 0 sót (entry cũ deprecated+redirectTo).

## 4. Pha 3 — Gates + regression + PR

- `agent-sync.ps1`: rebase sạch + migration PASS + tsc 0 + build PASS.
- Regression BE VPS (DB `mbw2_reg`, đã dọn): **61/61 OK** trên code Wave 2.
- pre-push-gate 22/22 (drift môi trường 3 lần — lệnh `deploy.mjs` chính thống, 0 file repo đổi).

## 5. CHƯA CHẠY / còn nợ (trung thực)

- E2E 2 SubAccount thật (AC1/AC2/AC5-E2E) · FE trên VPS · full BE suite · ruff.
- Ticket Wave 3: BE-READ (bindings GET) · expose `kind` + per-row `source` · hợp nhất `BrokerSettingsSection` · trùng id `portfolios-manage` · filter Khớp lệnh SSI/TCBS status.
- Tiếp: merge PR Wave 2 → cleanup nhánh/worktree/VPS theo protocol.
