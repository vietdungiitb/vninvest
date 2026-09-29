# OPEN CORE DEFAULT TEAM GOVERNANCE POLICY (OC-19)

Doc ID: OC-19
Ngay tao: 2026-04-18
Trang thai: MANDATORY DEFAULT POLICY (de xuat ap dung ngay)
Related docs: OPEN_CORE_00_INDEX.md, OPEN_CORE_13_COMMUNITY_PUBLISH_READINESS_V1.md, OPEN_CORE_15_DECISION_PACKET_CURRENT_20260418.md, OPEN_CORE_17_DOCS_GOVERNANCE_PRIVATE_PUBLIC_20260418.md, OPEN_CORE_18_PUBLIC_DOCS_ALLOWLIST_V1_20260418.md

## 1. Muc tieu

Dat ra quy dinh mac dinh cho doi code de:
1. docs khong bi loi thoi so voi runtime truth.
2. OpenCore governance duoc cap nhat lien tuc theo code thay doi.
3. Moi merge lien quan OpenCore deu co audit evidence va doc sync.

## 2. Pham vi ap dung

Ap dung cho moi PR co tac dong den:
1. Boundary Community / Pro / Pro Team.
2. Entitlement, quota, trial/grace, feature gate.
3. Docs governance private/public lane.
4. Public/community publication readiness.

## 3. Quy dinh mac dinh (MUST)

1. Thu muc docs/ trong monorepo la private docs by default.
2. Moi thay doi OpenCore phai cap nhat docs canonical cung PR (khong de no docs update).
3. Moi PR OpenCore phai co entry moi trong Code Change Audit Ledger.
4. Moi PR OpenCore phai cap nhat danh sach file trong Progress Dashboard.
5. Neu co thay doi policy lon, tao doc version moi (OC-xx moi) thay vi rewrite mat lich su.

## 4. Trigger-to-Docs mapping (bat buoc)

### T1 - Bugfix/Optimization nho (khong doi policy)
MUST update:
1. docs/CODE_CHANGE_AUDIT_LEDGER.md
2. PROGRESS_DASHBOARD.md

### T2 - Doi behavior Free/Pro hoac feature gate
MUST update:
1. docs/OPEN_CORE_05_FEATURE_BOUNDARY_MATRIX_V1.md
2. docs/OPEN_CORE_13_COMMUNITY_PUBLISH_READINESS_V1.md
3. docs/OPEN_CORE_15_DECISION_PACKET_CURRENT_20260418.md
4. docs/CODE_CHANGE_AUDIT_LEDGER.md
5. PROGRESS_DASHBOARD.md

### T3 - Doi quota/trial/entitlement/runtime mapping
MUST update:
1. docs/OPEN_CORE_11_NUMERIC_LOCK_SHEET_V1.md
2. docs/OPEN_CORE_12_ENTITLEMENT_QUOTA_IMPLEMENTATION_CHECKLIST_V1.md
3. docs/OPEN_CORE_15_DECISION_PACKET_CURRENT_20260418.md
4. docs/OPEN_CORE_13_COMMUNITY_PUBLISH_READINESS_V1.md
5. docs/CODE_CHANGE_AUDIT_LEDGER.md
6. PROGRESS_DASHBOARD.md

### T4 - Doi docs governance private/public
MUST update:
1. docs/OPEN_CORE_17_DOCS_GOVERNANCE_PRIVATE_PUBLIC_20260418.md
2. docs/OPEN_CORE_18_PUBLIC_DOCS_ALLOWLIST_V1_20260418.md
3. docs/OPEN_CORE_13_COMMUNITY_PUBLISH_READINESS_V1.md
4. docs/OPEN_CORE_15_DECISION_PACKET_CURRENT_20260418.md
5. docs/CODE_CHANGE_AUDIT_LEDGER.md
6. PROGRESS_DASHBOARD.md

## 5. Merge gate checklist (MUST PASS)

1. Runtime truth da duoc doi chieu voi docs canonical.
2. Trigger mapping o Muc 4 da duoc thuc hien day du.
3. Audit ledger da co entry moi.
4. Progress dashboard da cap nhat danh sach file.
5. Khong con mau thuan giua OC-13, OC-15, OC-11, OC-12 sau thay doi.

Neu 1 trong 5 muc fail -> Merge OpenCore lane = NO-GO.

## 6. SLA cap nhat docs

1. Cap nhat docs canonical trong cung PR code hoac truoc merge commit.
2. Tuyet doi khong de docs update tre hon 24h voi thay doi policy/boundary.
3. PR nao khong co evidence cap nhat docs theo trigger mapping se bi tra lai.

## 7. Vai tro va trach nhiem

1. PR owner:
- Chiu trach nhiem chinh cho doc sync theo trigger.

2. Tech reviewer:
- Xac nhan runtime truth va docs canonical khong mau thuan.

3. Product/owner reviewer:
- Xac nhan boundary/policy wording dung huong.

4. Compliance reviewer (khi lien quan publication):
- Xac nhan legal/disclaimer/public wording.

## 8. Weekly anti-stale review

Moi tuan 1 lan (de xuat thu Sau):
1. Review 4 tai lieu tru cot: OC-13, OC-15, OC-11, OC-12.
2. Neu phat hien drift -> tao ngay 1 audit entry "doc-runtime drift" va fix trong sprint hien tai.

## 9. Quy dinh doi voi publication lane

1. docs/ private khong duoc day len public lane mac dinh.
2. Public docs chi duoc tao tu allowlist OC-18.
3. Neu chua pass docs separation gate trong OC-13 -> tuyet doi khong public.

## 10. Next review checkpoint

- Governance checkpoint tiep theo: xac nhan team ap dung OC-19 nhu default rule trong moi PR OpenCore.

## 11. CI enforcement (bat buoc)

1. Workflow gate:
- .github/workflows/opencore-doc-sync-gate.yml

2. Gate script:
- scripts/quality/check_opencore_doc_sync.ps1

3. PR template mandatory checklist:
- .github/pull_request_template.md

4. Branch protection setup guide:
- OPEN_CORE_21_BRANCH_PROTECTION_OC19_SETUP_20260418.md

5. Rule van hanh:
- Neu gate fail thi PR OpenCore khong duoc merge.
- Neu gate pass nhung reviewer phat hien drift thuc te thi van duoc phep block merge.

6. Enforcement requirement tren hosting:
- Branch protection cua dev/main/deploy phai bat required status check OpenCore Doc Sync Gate.