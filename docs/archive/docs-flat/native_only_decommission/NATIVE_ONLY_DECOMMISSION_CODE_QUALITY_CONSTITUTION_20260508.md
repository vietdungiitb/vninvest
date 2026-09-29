# CODE QUALITY CONSTITUTION - Native-Only Decommission

**Ngay**: 2026-05-08

---

## 1. Quality definition

Chuong trinh nay khong xong khi build pass. Chuong trinh chi xong khi:

1. Route active da co native owner.
2. Proxy fallback da bi xoa.
3. Production khong con duong lui am tham ve legacy.
4. Evidence va audit trail du de audit lai khong can doan.

---

## 2. Non-negotiable rules

1. Khong them compat route moi de che giu deprecation.
2. Khong giu catch-all proxy sau khi native owner da san sang.
3. Khong forward hop-by-hop headers neu proxy con ton tai tam thoi trong branch trung gian.
4. Khong log request body trong proxy/bridge.
5. Khong de production compose co wildcard hay debug-gated legacy config.

---

## 3. Coverage targets

| Area | Target |
|---|---:|
| Auth / partner cutover | 90% risk coverage |
| Portfolio / workspace cutover | 95% risk coverage |
| Market / realtime route cutover | 90% risk coverage |
| Proxy removal | 100% gate coverage |
| Production compose cleanup | 100% gate coverage |

---

## 4. Coverage theater prevention

Khong tinh la bang chung chat luong neu chi co:

1. `build` pass ma khong co route resolver proof.
2. Test render route ma khong assert native handler.
3. `grep` cleanup ma khong co browser smoke sau deploy.
4. Doc update ma khong co evidence template va audit ledger.

---

## 5. Human gate

1. Team phai xac nhan route ownership truoc khi xoa compat wrapper.
2. Team phai xac nhan no-proxy state truoc khi xoa `legacy_proxy.py`.
3. Team phai xac nhan no-legacy-config state truoc khi chot decommission.
