# EXECUTION EVIDENCE TEMPLATE — SaaS Services Recovery

**Ngày**: 2026-05-11  
**Dùng cho**: mọi slice thuộc SSR-R0..SSR-R6

---

```markdown
# Evidence — {SLICE_ID}: {SLICE_TITLE}

**Ngày thực hiện**: YYYY-MM-DD  
**Owner**: [Tên]  
**Phase**: R{N}

---

## 1. Files đã thay đổi

| File | Loại thay đổi | Dòng thay đổi |
|---|---|---|
| path/to/file | Modified/New | +X / -Y |

---

## 2. Validation commands và kết quả

```powershell
# command 1
# command 2
```

**Kết quả tóm tắt**:
- [PASS/FAIL] command 1
- [PASS/FAIL] command 2

---

## 3. Runtime health snapshot

```text
[Paste docker ps / compose ps summary]
```

---

## 4. Smoke test snapshot

| Test | Expected | Actual | Status |
|---|---|---|---|
| /core/v1/health | 200 | 200 | PASS |
| /api/health/ | 200 | 200 | PASS |

---

## 5. Payload snapshot (nếu có)

```json
{
  "sample": "response"
}
```

---

## 6. Risk còn lại

- [None hoặc mô tả cụ thể]

---

## 7. Checklist đóng slice

- [ ] Taskboard cập nhật
- [ ] docs/CODE_CHANGE_AUDIT_LEDGER.md cập nhật
- [ ] PROGRESS_DASHBOARD.md cập nhật
- [ ] Nếu có thay đổi code runtime/UI: stack đã rebuild/restart
```
