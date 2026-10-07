# HANDOVER — Sửa `AGENTS.md` (Owner tự áp dụng)

**Ngày:** 2026-10-06 · **Claim:** `opencode-portfolio-safe04-pav`

## Vì sao không tự sửa

`AGENTS.md` nằm trong **shared-file deny list** ở **cả hai** gate:

| Gate | Dòng |
|---|---|
| `packages/web/scripts/check-multi-agent.mjs` | `DENY_LIST[0] = "AGENTS.md"` (`:28`) |
| `.githooks/pre-commit` | `DENY='AGENTS.md` (`:21`) |

`AGENTS.md:20` ghi rõ: *"Hook sẽ chặn"* và `AGENT_PROTOCOL.md` §2 quy định:
**ghi vào claim + báo coordinator, không tự sửa.**

Lý do gốc (ghi trong chính repo): `AGENTS.md` là **một mục `Progress` chung**
nên hunk gộp không tách được — đã xảy ra thật 2026-09-26 khiến nội dung của
hai agent bị hàn vào một commit.

Lần commit đầu của phiên này, gate `check-multi-agent` **BLOCK** vì claim tôi
khai báo `AGENTS.md` trong cột `files`. Đó là gate làm đúng việc, không phải
false positive — nên tôi bỏ `AGENTS.md` khỏi claim thay vì lách.

---

## Sửa 1 — `AGENTS.md:73` (Owner đã chỉ định)

**Hiện tại (sai):**

```markdown
- **P0-LEGAL-01:** license `vnbroker` chưa ký ⇒ **R3 live trading không tồn tại**.
```

**Thay bằng:**

```markdown
- **P0-LEGAL-01 — ĐÃ ĐÓNG 2026-09-27.** Owner chốt: `vnbroker` là **sở hữu của
  chủ repo** ⇒ đổi từ "license chưa ký = blocker" thành **"không còn blocker
  pháp lý"**; **R3 live trading được phép**. Nguồn: `docs/CLAIMS.md:251`
  (claim `portfolio-exec-plan`). Dòng cũ "R3 live trading không tồn tại" là
  **stale**, đã bị chính claim đó phủ định.
```

**Cũng nên sửa `AGENTS.md:76`** (cùng mục, câu "Order tiếp"), vì nó vẫn dẫn về
việc ký license:

```markdown
- **Order tiếp:** owner revoke/rotate P0-SEC-01 ~~+ ký license~~ **+ ~~ký
  license~~** (P0-LEGAL-01 đã đóng 2026-09-27 — xem dòng trên). Wave 2
  ~~chỉ mở sau khi 6 agent `tenantreg-*` xong~~ — **ĐÃ SAI, đã sửa 2026-09-27,
  xem mục "VERIFY 6 slice tenantreg" ngay phía trên.** 6 agent đã `released` +
  merge. Wave 2 (read-only portfolio foundation) **mở được ngay**.
```

---

## Sửa 2 — `AGENTS.md:71` và `:75` (đã xác minh, chưa yêu cầu nhưng liên quan)

Hai dòng này liệt kê nợ cũ **đã được sửa**. Để lại sẽ dẫn agent sau tới sửa
lại code đã đúng.

**`:71`** — `(1) mọi lệnh DNSE từ UI trả 400 vì BE đọc payload['volume'] còn FE
gửi 'quantity'` và `(2) audit order không ghi được vì `broker.place_order` 18 ký
tự > `max_length=16`:

```markdown
- **2 P0 MỚI…: (1)** ~~mọi lệnh DNSE từ UI trả 400 vì BE đọc
  `payload['volume']` còn FE gửi `'quantity'`~~ **ĐÃ SỬA** — `views_dnse.py:68-69`
  nhận alias, `:90-135` phát hiện `order_volume_conflict`; test
  `adapters/core/__tests__/dnse-order-contract.test.js` xanh. **(2)** ~~audit
  order không ghi được~~ **ĐÃ SỬA** — `views_dnse.py:236-237` dùng
  `AuditEvent.ActionChoices.CREATE`, `:783` `_finalize_audit_event(...,
  'accepted')` ghi kết quả vào `metadata` thay vì nhồi vào cột `action`.
```

**`:75`** — `ops_audit.action max_length=16` nằm trong "Còn nợ":

```markdown
- **Còn nợ (ticket riêng):** ~~`ops_audit.action` `max_length=16`~~ **ĐÃ XỬ
  LÝ** (xem dòng trên) · ~6 chỗ fail-open `if tenant: … else:` trong `views.py`
  (`views.py` nay đã có `TenantScopePermission` nên các nhánh else là dead code —
  xem `docs/evidence/portfolio-commercial/REPORT_FINAL.md`) · `UserBrokerConfig`
  tenant-blind ở 5 call site `views_broker.py:111,153,164,178,202` ·
  `Idempotency-Key` trên cache nên thành `OrderJob` · `order_type` chưa validate
  · **D-19 chưa đạt** vì 1 test flaky pre-existing.
```

---

## Sửa 3 — `docs/OPEN_WORK_20260929.md` (đã xác minh, 3 mục đã lỗi thời)

| Mục | Ghi | Thực tế |
|---|---|---|
| OW-01 secret còn trong git | đang chờ | `git ls-files` chỉ còn 6 file `*.example` |
| OW-02 `SecretStore` chưa có | đang chờ | **Đã có** ở `vninvest_core/utils/encryption.py` (`SecretStore`, `SecretKeyMissingError`, `.reencrypt()`, `.current_version()`) |
| OW-03 GitHub Actions đã tắt | đang chờ billing | **Đã bật** `.github/workflows/secret-scan.yml:25,28,50,54` (1 workflow, không phải 6) |

---

## Sửa 4 — 4 claim stale

Đã xử lý bằng cách append dòng `superseded` vào `docs/CLAIMS.md`, **không xoá
dòng cũ** (commit `8149e96af`). Chi tiết bằng chứng trong chính dòng claim mới.

Lưu ý khi đọc `check-multi-agent`: nó vẫn báo **63 cảnh báo** "file không tồn
tại". Phần lớn là do claim/archive stale, **không** phải mất file. Gate không
phân biệt được nên cảnh báo vẫn ở đó.

---

## Áp dụng

```bash
# Sửa tay 4 mục trên trong AGENTS.md và OPEN_WORK_20260929.md, rồi:
node packages/web/scripts/check-multi-agent.mjs
git add AGENTS.md docs/OPEN_WORK_20260929.md
git commit -m "docs(agents): dong 4 muc stale (P0-LEGAL-01, volume/quantity, action max_length, OW-01..03)"
```

Không cần `--no-verify`: deny-list chặn *agent* sửa khi đang có agent khác
chạy song song. Khi Owner tự commit thì hợp lệ — nhưng nên kiểm
`git status` sạch trước, vì `AGENTS.md` là hunk gộp không tách được.