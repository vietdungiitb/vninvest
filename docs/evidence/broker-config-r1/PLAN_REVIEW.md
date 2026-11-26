# PLAN REVIEW — Broker Config R1 (độc lập, 2026-11-26)

- **Reviewer:** agent độc lập (fresh context, read-only), ngày 2026-11-26.
- **Đối tượng:** `docs/PLAN_BROKER_CONFIG_S1_20261126.md` (bản đầu, tự gọi S1+S2b).
- **VERDICT:** **NEED_REVISION** — plan đúng hướng (nối runtime, cross-consistency, không tự code broker) nhưng 5/8 AC chưa thi hành được hoặc thi hành sai tầng.
- **Kết quả sau revision:** plan REV 1 đã sửa cả 8 objection (xem đối chiếu dưới), đổi tên slice thành `broker-config-r1`.

| # | Mức | Objection (bản đầu) | Cách sửa trong REV 1 |
|---|---|---|---|
| 1 | P0 | AC4 block mọi Apply: staging 0 credential nhưng default bật 3 provider (`domain_configs/broker.py:187-202`); dataclass thuần không truy DB | Chỉ 400 khi credential có nhưng purpose lạ; thiếu credential = warning; helper đặt ở `broker.py` (preview + post) |
| 2 | P0 | AC7 sửa sai tầng: `from_dict()` `:150-162` bỏ key lạ trước `to_dict()` `:164-173` | Merge tại view `broker.py:270,312` với allowlist 2 reserved key |
| 3 | P0 | AC5 chưa fail-closed: `provider_for_purpose()` trả `ssi` ⇒ UI nói SSI, runtime vẫn DNSE qua fallback (`tasks.py:2520-2525`) | Chỉ nhận `'dnse'`, khác ⇒ log + ép DNSE; local import theo pattern `:2497-2512` |
| 4 | P1 | AC6 thiếu so sánh plaintext secret trước `set_secrets()` | Đọc `cred.get_secrets()` trước `:465`, so plaintext; rotate ⇒ reset |
| 5 | P1 | AC8 purpose lạ bị lọc ở `domain_configs/broker.py:94` trước `validate()` `:77-79` | Validate payload thô tại `broker.py:264-268,309-310` |
| 6 | P1 | Scope lệch (gồm AC của S2/S4) + claim `cafef-ref` stale | Đổi tên slice `broker-config-r1`; scope ghi rõ S1+S2+S2b+S4 phần; không đụng claim người khác, ghi chú stale |
| 7 | P1 | Test assert raw key nhờ fallback `LangContext.js:113-121`; E2E thiếu kịch bản; baseline sai | Rewrite test có `LangProvider`, AC9/AC10 kịch bản cụ thể, re-baseline `git status` |
| 8 | P2 | B-12/decrypt_failed để S2; `cred_secrets` đã có; nhãn verify là S3 | Ghi rõ defer trong Non-goals; chỉ thêm 3 key đúng; AC6 không đổi nhãn |

**Gate reviewer:** KHÔNG chạy (read-only). Mọi gate thực thi ở bước B7 của slice. File này là bằng chứng B3/B4 theo luật 6 — chat-only không hợp lệ.
