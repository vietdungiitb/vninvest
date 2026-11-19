# W0 contrast simulation — RED (truoc fix)

Lệnh: copy 4 file CSS + scripts vào temp, xoá 13 khai báo base, chạy `check-theme-contrast.mjs --repo <tmp> --no-runtime`.

EXIT=1

```
  CONTROL #ffffff tren #000000 = 21.00:1 (mong doi 21.00:1) OK
  CONTROL #777777 tren #ffffff = 4.48:1 (mong doi 4.48:1) OK
  CHUA CHAY: canvas runtime — bi bo qua bang --no-runtime
check-theme-contrast — 36 cap do khong dat WCAG AA (4.5:1) | baseline 32 | file: packages/web/scripts/check-ui-baseline/check-theme-contrast.json
  TAP VI PHAM HIEN TAI (id = pair@variant/theme):
    accent-cyan-on-bg-primary@soc/light  --accent-cyan tren --color-bg-primary = 3.77:1 (< 4.5:1) · soc/light
    color-text-muted-on-bg-primary@shell/dark  --color-text-muted tren --color-bg-primary = 4.24:1 (< 4.5:1) · shell/dark
    color-text-muted-on-bg-primary@shell/light  --color-text-muted tren --color-bg-primary = 4.24:1 (< 4.5:1) · shell/light
    color-text-muted-on-bg-primary@soc/dark  --color-text-muted tren --color-bg-primary = 4.24:1 (< 4.5:1) · soc/dark
    color-text-muted-on-bg-primary@soc/light  --color-text-muted tren --color-bg-primary = 4.24:1 (< 4.5:1) · soc/light
    color-text-muted-on-bg-secondary@shell/dark  --color-text-muted tren --color-bg-secondary = 3.75:1 (< 4.5:1) · shell/dark
    color-text-muted-on-bg-secondary@shell/light  --color-text-muted tren --color-bg-secondary = 3.75:1 (< 4.5:1) · shell/light
    color-text-muted-on-bg-secondary@soc/dark  --color-text-muted tren --color-bg-secondary = 3.75:1 (< 4.5:1) · soc/dark
    color-text-muted-on-bg-secondary@soc/light  --color-text-muted tren --color-bg-secondary = 3.75:1 (< 4.5:1) · soc/light
    text-muted-on-bg-panel-token@shell/dark  --text-muted tren --bg-panel = 3.75:1 (< 4.5:1) · shell/dark
    text-muted-on-bg-panel-token@soc/dark  --text-muted tren --bg-panel = 3.75:1 (< 4.5:1) · soc/dark
    text-muted-on-bg-panel@shell/dark  --text-muted tren --color-bg-panel = 3.75:1 (< 4.5:1) · shell/dark
    text-muted-on-bg-panel@shell/light  --text-muted tren --color-bg-panel = 3.75:1 (< 4.5:1) · shell/light
    text-muted-on-bg-panel@soc/dark  --text-muted tren --color-bg-panel = 3.75:1 (< 4.5:1) · soc/dark
    text-muted-on-bg-panel@soc/light  --text-muted tren --color-bg-panel = 2.36:1 (< 4.5:1) · soc/light
    text-muted-on-bg-primary@shell/dark  --text-muted tren --color-bg-primary = 4.24:1 (< 4.5:1) · shell/dark
    text-muted-on-bg-primary@shell/light  --text-muted tren --color-bg-primary = 4.24:1 (< 4.5:1) · shell/light
    text-muted-on-bg-primary@soc/dark  --text-muted tren --color-bg-primary = 4.24:1 (< 4.5:1) · soc/dark
    text-muted-on-bg-primary@soc/light  --text-muted tren --color-bg-primary = 2.66:1 (< 4.5:1) · soc/light
    text-muted-on-bg-secondary@shell/dark  --text-muted tren --color-bg-secondary = 3.75:1 (< 4.5:1) · shell/dark
    text-muted-on-bg-secondary@shell/light  --text-muted tren --color-bg-secondary = 3.75:1 (< 4.5:1) · shell/light
    text-muted-on-bg-secondary@soc/dark  --text-muted tren --color-bg-secondary = 3.75:1 (< 4.5:1) · soc/dark
    text-muted-on-bg-secondary@soc/light  --text-muted tren --color-bg-secondary = 2.36:1 (< 4.5:1) · soc/light
    text-on-accent-on-accent-cyan@shell/dark  --text-on-accent tren --accent-cyan = 2.43:1 (< 4.5:1) · shell/dark
    text-on-accent-on-accent-cyan@shell/light  --text-on-accent tren --accent-cyan = 2.43:1 (< 4.5:1) · shell/light
    text-on-accent-on-accent-cyan@soc/dark  --text-on-accent tren --accent-cyan = 2.43:1 (< 4.5:1) · soc/dark
    text-primary-on-bg-panel@shell/light  --text-primary tren --color-bg-panel = 1.00:1 (< 4.5:1) · shell/light
    text-primary-on-bg-panel@soc/light  --text-primary tren --color-bg-panel = 1.00:1 (< 4.5:1) · soc/light
    text-primary-on-bg-primary@shell/light  --text-primary tren --color-bg-primary = 1.13:1 (< 4.5:1) · shell/light
    text-primary-on-bg-primary@soc/light  --text-primary tren --color-bg-primary = 1.13:1 (< 4.5:1) · soc/light
    text-primary-on-bg-secondary@shell/light  --text-primary tren --color-bg-secondary = 1.00:1 (< 4.5:1) · shell/light
    text-primary-on-bg-secondary@soc/light  --text-primary tren --color-bg-secondary = 1.00:1 (< 4.5:1) · soc/light
    text-secondary-on-bg-primary@shell/light  --text-secondary tren --color-bg-primary = 1.95:1 (< 4.5:1) · shell/light
    text-secondary-on-bg-primary@soc/light  --text-secondary tren --color-bg-primary = 1.95:1 (< 4.5:1) · soc/light
    text-secondary-on-bg-secondary@shell/light  --text-secondary tren --color-bg-secondary = 1.72:1 (< 4.5:1) · shell/light
    text-secondary-on-bg-secondary@soc/light  --text-secondary tren --color-bg-secondary = 1.72:1 (< 4.5:1) · soc/light
  ⚠ 12 cap KHONG doc duoc (khong ket luan, khong coi la trong suot):
    text-primary-on-bg-panel-solid@shell/dark  shell/dark: text-primary-on-bg-panel-solid (--bg-panel-solid khong doc duoc duoc giai ma tinh)
    pf-gain-on-pf-surface@shell/dark  shell/dark: pf-gain-on-pf-surface (--pf-gain khong doc duoc duoc giai ma tinh)
    pf-loss-on-pf-surface@shell/dark  shell/dark: pf-loss-on-pf-surface (--pf-loss khong doc duoc duoc giai ma tinh)
    pf-flat-on-pf-surface@shell/dark  shell/dark: pf-flat-on-pf-surface (--pf-flat khong doc duoc duoc giai ma tinh)
    pf-positive-text-on-pf-positive-soft@shell/dark  shell/dark: pf-positive-text-on-pf-positive-soft (--pf-positive-text khong doc duoc duoc giai ma tinh)
    pf-negative-text-on-pf-negative-soft@shell/dark  shell/dark: pf-negative-text-on-pf-negative-soft (--pf-negative-text khong doc duoc duoc giai ma tinh)
    text-primary-on-bg-panel-solid@shell/light  shell/light: text-primary-on-bg-panel-solid (--bg-panel-solid khong doc duoc duoc giai ma tinh)
    pf-gain-on-pf-surface@shell/light  shell/light: pf-gain-on-pf-surface (--pf-gain khong doc duoc duoc giai ma tinh)
    pf-loss-on-pf-surface@shell/light  shell/light: pf-loss-on-pf-surface (--pf-loss khong doc duoc duoc giai ma tinh)
    pf-flat-on-pf-surface@shell/light  shell/light: pf-flat-on-pf-surface (--pf-flat khong doc duoc duoc giai ma tinh)
    pf-positive-text-on-pf-positive-soft@shell/light  shell/light: pf-positive-text-on-pf-positive-soft (--pf-positive-text khong doc duoc duoc giai ma tinh)
    pf-negative-text-on-pf-negative-soft@shell/light  shell/light: pf-negative-text-on-pf-negative-soft (--pf-negative-text khong doc duoc duoc giai ma tinh)


  ✗ 4 VI PHAM MOI (khong co trong baseline):
    text-muted-on-bg-panel-token@soc/dark  --text-muted tren --bg-panel = 3.75:1 (< 4.5:1) · soc/dark
    text-muted-on-bg-panel@soc/dark  --text-muted tren --color-bg-panel = 3.75:1 (< 4.5:1) · soc/dark
    text-muted-on-bg-primary@soc/dark  --text-muted tren --color-bg-primary = 4.24:1 (< 4.5:1) · soc/dark
    text-muted-on-bg-secondary@soc/dark  --text-muted tren --color-bg-secondary = 3.75:1 (< 4.5:1) · soc/dark
  ✗ REGRESSION — gate that.

```
