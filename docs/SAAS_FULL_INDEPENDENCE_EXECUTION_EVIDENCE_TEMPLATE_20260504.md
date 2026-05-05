# EXECUTION EVIDENCE TEMPLATE — SaaS Full Independence

**Ngày**: 2026-05-04  
**Dùng cho**: Mỗi slice sau khi hoàn thành phải điền template này  
**Lưu tại**: `docs/evidence/SFI-{SLICE_ID}-EVIDENCE-{YYYYMMDD}.md`

---

## Template chuẩn

```markdown
# Evidence — {SLICE_ID}: {SLICE_TITLE}

**Ngày thực hiện**: YYYY-MM-DD  
**Developer**: [tên]  
**Phase**: B{N}

---

## 1. Files đã thay đổi

| File | Loại thay đổi | Dòng thay đổi |
|------|--------------|--------------|
| path/to/file.py | Modified | +25 / -8 |
| path/to/new_file.py | New | +150 / -0 |

---

## 2. Validation command và kết quả

```powershell
# [Paste validation command ở đây]
```

**Kết quả**:
```
[Paste output ở đây]
```

**Kết luận**: PASS / FAIL

---

## 3. Smoke test kết quả

| Test | Expected | Actual | Status |
|------|---------|--------|--------|
| /api/health/ → 200 | 200 | 200 | ✅ |
| ... | ... | ... | ... |

---

## 4. Payload snapshot (nếu chạm contract)

```json
{
  "sample_response": {}
}
```

---

## 5. Parity report (nếu B3+)

```
Symbols tested: 20
Matched: 20
Parity: 100%
```

---

## 6. Docker stack health sau slice

```
[Paste: docker ps --format "table {{.Names}}\t{{.Status}}"]
```

---

## 7. Residual risks

- [Mô tả nếu còn risk tồn đọng, hoặc "None"]

---

## 8. Taskboard update

- [ ] Taskboard updated (`TASKBOARD_SAAS_FULL_INDEPENDENCE_20260504.md`)
- [ ] `docs/CODE_CHANGE_AUDIT_LEDGER.md` updated
- [ ] module_tree_full.md regenerated (chỉ nếu có new files)
```

---

## Ví dụ evidence đã điền cho SFI-B1.7

```markdown
# Evidence — SFI-B1.7: Smoke test toàn bộ B1 + rebuild stack

**Ngày thực hiện**: 2026-05-05  
**Developer**: Backend Lead  
**Phase**: B1

---

## 1. Files đã thay đổi

| File | Loại thay đổi | Dòng thay đổi |
|------|--------------|--------------|
| packages/core/backend/requirements.txt | Modified | +1 / -0 |
| packages/core/backend/src/vninvest_core/legacy_proxy.py | New | +120 / -0 |
| packages/core/backend/src/vninvest_core/urls.py | Modified | +3 / -0 |
| packages/core/backend/src/vninvest_core/settings.py | Modified | +3 / -0 |
| frontend/docker/nginx.conf | Modified | +5 / -8 |
| docker-compose.dev.yml | Modified | +3 / -4 |

---

## 2. Validation command và kết quả

```powershell
docker compose -f docker-compose.dev.yml up -d --build frontend core-api 2>&1 | Select-Object -Last 5
```

**Kết quả**:
```
[+] Running 9/9
 ✔ Container vninvest-dev-core-api    Healthy
 ✔ Container vninvest-dev-frontend    Started
```

**Kết luận**: PASS

---

## 3. Smoke test kết quả

| Test | Expected | Actual | Status |
|------|---------|--------|--------|
| GET /api/health/ | 200 | 200 | ✅ |
| GET /api/portfolio/portfolios/ | 401 (not 502) | 401 | ✅ |
| GET /api/realtime/ticker/VIC/ | 200 with data | 200 | ✅ |
| GET /core/v1/health | 200 | 200 | ✅ |
| Port 8000 not exposed | no results | no results | ✅ |

---

## 7. Residual risks

- Legacy backend vẫn chạy (intentional — proxy target). B2+ sẽ migrate dần.

---

## 8. Taskboard update

- [x] Taskboard updated
- [x] `docs/CODE_CHANGE_AUDIT_LEDGER.md` updated
- [x] module_tree_full.md regenerated
```
