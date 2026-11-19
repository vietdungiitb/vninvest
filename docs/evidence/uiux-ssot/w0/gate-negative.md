# W0 baseline negative proof (Task 3)

Inject `--text-primary: #e2e8f0;` vào bản sao `soc.tokens.css`, chạy gate với baseline đã hạ về 0.

EXIT=1

```
check-token-conflict [scope=base · mode B (@theme + moi khoi :root)] — 1 vi pham hien tai | baseline 0 | file: D:/Mujoco Projects/uiux-ssot-w0/packages/web/scripts/check-ui-baseline/check-token-conflict.json
  TAP VI PHAM HIEN TAI:
    --text-primary@5cc2cad3  packages/web/src/theme/tokens.css:1 (:root) = var(--color-text-primary, #f1f5f9)  ||  packages/web/src/components/soc/soc.tokens.css:5 (:root) = #e2e8f0


  ✗ 1 VI PHAM MOI (khong co trong baseline):
    --text-primary@5cc2cad3  packages/web/src/theme/tokens.css:1 (:root) = var(--color-text-primary, #f1f5f9)  ||  packages/web/src/components/soc/soc.tokens.css:5 (:root) = #e2e8f0
  ✗ REGRESSION — gate that.

```
