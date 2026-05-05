# WEB VIP APP SHARED FRONTEND BLUEPRINT

**Date:** 2026-05-02  
**Status:** Recommended execution blueprint  
**Purpose:** Chot cach thiet ke `web` va `vip-app` theo huong ke thua toi da: 1 frontend source, 2 backend ownership planes, chi phi clone gan nhu bang 0. Trong mo hinh nay, `packages/opencore` se package hoa community/self-host lane nhung khong so huu frontend source rieng.

**Companion artifacts:**

- [CORE_WEB_VIP_APP_INTEGRATED_ARCHITECTURE_20260502](./CORE_WEB_VIP_APP_INTEGRATED_ARCHITECTURE_20260502.md)
- [CODEBASE_RESTRUCTURING_PROPOSAL_20260501](./CODEBASE_RESTRUCTURING_PROPOSAL_20260501.md)
- [REPO_STRATEGY_AND_EXECUTION_ROADMAP_20260501](./REPO_STRATEGY_AND_EXECUTION_ROADMAP_20260501.md)
- [ENTERPRISE_CORE_ADMIN_UI_ARCHITECTURE_20260502](./ENTERPRISE_CORE_ADMIN_UI_ARCHITECTURE_20260502.md)
- [ENTERPRISE_CORE_ACCESS_CAPABILITY_PAYLOAD_CONTRACT_20260502](./ENTERPRISE_CORE_ACCESS_CAPABILITY_PAYLOAD_CONTRACT_20260502.md)
- [VIP_APP_INTERNAL_ADMIN_FEATURES_20260501](./VIP_APP_INTERNAL_ADMIN_FEATURES_20260501.md)

---

## 1. Executive decision

Phuong an kha thi nhat cho VNInvest la:

1. **Chi dung 1 frontend source** trong `web`.
2. **`packages/opencore` chi package hoa community/self-host build va upgrade funnel, khong so huu source clone**.
3. **Khong tao frontend rieng trong `vip-app`**.
4. `vip-app` chi so huu **local backend + orchestrator + packaging**.
5. Su khac nhau giua web SaaS va VIP duoc xu ly boi:
   - `BUILD_TARGET` o compile-time,
   - capability snapshot o runtime,
   - API adapter theo ownership plane.

Neu lam dung boundary, phan trung lap thuc su giua web va VIP se o muc rat thap. Phan khac nhau chu yeu khong nam o UI shell ma nam o:

- ai so huu du lieu,
- browser goi backend nao,
- route nao duoc mo,
- man hinh admin nao duoc hien.

---

## 2. Dieu canh chinh lai trong nhan dinh "giong nhau 95%"

Nhan dinh nay **co ban la dung**, nhung can viet lai chinh xac hon de tranh sai boundary:

1. `web` va `VIP build` giong nhau khoang 95% o **presentation shell, charts, watchlist, navigation, auth bootstrap, i18n, workspace interactions**.
2. Su khac nhau **khong chi** la `web` co them `Core Admin UI`.
3. VIP con co them **VIP Internal Admin** cho local concerns nhu:
   - sub-users,
   - branding,
   - local AI keys,
   - prompt studio,
   - local usage analytics.

Ket luan dung la:

> `web` va `VIP build` nen la **hai bien the cua cung mot frontend source**, trong do `web` mo them central operator / tenant admin surfaces, con VIP mo them local internal admin surfaces. Community/OpenCore lane duoc dong goi boi `packages/opencore`, khong phai mot frontend source moi.

---

## 3. Boundary model phai giu

```text
Browser UI (shared web source)
    |
  |-- Community / OpenCore build ---> opencore distribution -------> core user/opencore APIs
  |
    |-- SaaS / central build ----------> core APIs
    |
    |-- VIP build ---------------------> vip local backend ----------> core partner APIs
```

### 3.1 `core`

So huu:

- market data va signal intelligence,
- entitlement / quota / billing,
- operator APIs,
- partner APIs,
- audit va runtime semantics.

Khong so huu:

- React admin shell,
- VIP local RBAC,
- VIP local secret storage,
- VIP local branding.

### 3.2 `web`

So huu:

- toan bo React shell dung chung,
- community/OpenCore build artifacts,
- pages dung chung,
- build variants,
- route gating,
- navigation gating,
- component library,
- i18n, forms, charts, interaction model.

### 3.3 `vip-app`

So huu:

- local backend,
- local user CRUD,
- local RBAC,
- local AI key storage,
- local chat logs,
- local usage analytics,
- orchestrator,
- self-host packaging.

Khong so huu:

- frontend source clone,
- business rules noi bo cua `core`,
- central operator UI.

---

## 4. Tai sao 1 source la dung hon 2 codebases

Neu tach rieng `web frontend` va `vip frontend`, team se gap 6 chi phi lap lai:

1. Route tree lap lai.
2. Layout, nav, auth bootstrap lap lai.
3. Chart surface va state machine lap lai.
4. i18n keys va wording lap lai.
5. Regression QA lap lai tren hai codebase.
6. Refactor UI shell sau nay phai lam hai lan.

Ngược lai, 1 source + build variants cho phep:

- code mot lan cho phan shell va feature chung,
- chi viet them module variant-specific,
- giam regression drift giua SaaS va VIP,
- giu duoc kha nang tach repo sau nay ma khong clone logic.

Day la phuong an co chi phi tong so huu thap nhat.

---

## 5. Current-code anchors da co san

Repo hien tai da co cac diem neo du de di theo huong nay:

- `frontend/src/App.jsx` co route shell tap trung.
- `frontend/src/context/PortfolioContext.jsx` da bootstrap auth state, `userPlan`, identity va ability.
- `frontend/src/context/AbilityContext.js` da co CASL ability context.
- `frontend/src/components/ProtectedRoute.jsx` da co route-level gating.
- `frontend/src/components/Can.jsx` da co component-level gating.
- `frontend/src/components/TopNav.jsx` da co menu gating theo ability.

Dieu repo hien tai **chua co**:

- `packages/web/src/config/buildTarget.js`,
- capability snapshot shape chuan hoa cho admin / VIP surfaces,
- API adapter layer tach ro `core` voi `vip local backend`,
- feature folders chia ro shared / saas / vip.

Hieu dung van de: chung ta **khong thieu nen mong**, chung ta thieu **seam va boundary artifacts**.

---

## 6. Kien truc ke thua duoc de xuat

## 6.1 Hai truc gating bat buoc

Frontend nen su dung dong thoi 2 truc gating:

### Truc A - `BUILD_TARGET` o compile-time

Gia tri de xuat:

- `community`
- `saas`
- `vip`

Tac dung:

- loai bo route group khong thuoc san pham,
- loai bo bundle code khong can phan phoi,
- giup VIP build khong keo central operator shell neu khong can.

### Truc B - capability snapshot o runtime

Tac dung:

- user nao thay menu nao,
- role nao duoc vao route nao,
- man hinh nao chi read-only,
- VIP local role nao duoc chat AI hay backtest.

`BUILD_TARGET` quyet dinh **san pham nao**, capability quyet dinh **nguoi dung nao trong san pham do**.

---

## 6.2 Ba lop module trong frontend

```text
packages/web/src/
  config/
    buildTarget.js
  app/
    routeCatalog.js
    navigationCatalog.js
  features/
    shared/
    saas/
    vip/
  adapters/
    core/
    vip/
```

### Lop 1 - `shared`

Chua:

- dashboard shell,
- stock detail,
- whale alerts,
- AI advisory shell,
- chart widgets,
- reusable tables/forms,
- i18n strings dung chung,
- auth bootstrap,
- common hooks.

Muc tieu: day la 80-95% khoi luong frontend.

### Lop 2 - `saas`

Chua:

- Central Operator Admin,
- Tenant Admin Console,
- central commercial/account pages,
- operator-only runtime pages.

### Lop 3 - `vip`

Chua:

- White-label settings,
- Sub-user management,
- Core connections,
- AI prompt studio,
- Usage analytics local,
- local audit/chat views.

---

## 6.3 API adapter pattern bat buoc

Khong de pages goi truc tiep axios theo dang tu phat. Can co adapter seam:

```text
shared UI page
    -> domain hook
        -> service adapter
            -> core client OR vip local client
```

### Adapter `core`

Dung cho:

- SaaS / central build,
- cac route user thong thuong,
- operator va tenant admin pages noi chuyen voi `core`.

### Adapter `vip`

Dung cho:

- VIP build,
- local admin routes,
- browser calls vao local backend,
- local backend moi tiep tuc goi partner APIs cua `core`.

Hard rule:

1. Browser VIP **khong** cam PAT de goi truc tiep `core` nhu machine client.
2. Browser VIP goi local backend.
3. Local backend moi la noi giu credentials va goi `core`.

---

## 6.4 Route taxonomy nen dung

### Shared routes

Day la nhom route nen giu chung source va chung component ownership:

- `/dashboard`
- `/stocks/:symbol`
- `/ai-advisory`
- `/whale-alerts`
- `/whale-alerts/:symbol`
- `/watchlist`
- `/transactions`
- `/portfolios`
- `/settings`

### SaaS-only routes

- `/admin/core/*`
- `/tenant-admin/*`
- central support / operator-only control routes

### VIP-only routes

- `/vip-admin/organization`
- `/vip-admin/sub-users`
- `/vip-admin/core-connections`
- `/vip-admin/ai-prompts`
- `/vip-admin/usage-analytics`

Nghia la route tree nen duoc coi la **mot catalog duy nhat**, khong phai hai router tach roi.

---

## 7. Route and ownership matrix

| Surface | Frontend source | Browser talks to | Backend owner | Gating |
|---|---|---|---|---|
| KLine / Whale / Advisory | shared | `core` trong SaaS, `vip local backend` trong VIP neu can local mediation | `core` data-plane | build target + capability |
| Central Operator Admin | shared source, saas module | `core` | `core` | `BUILD_TARGET=saas` + operator ability |
| Tenant Admin Console | shared source, saas module | `core` | `core` | `BUILD_TARGET=saas` + tenant admin ability |
| VIP Internal Admin | shared source, vip module | `vip local backend` | `vip-app` | `BUILD_TARGET=vip` + local role |
| Branding / local usage / prompt studio | shared source, vip module | `vip local backend` | `vip-app` | `BUILD_TARGET=vip` |

---

## 8. Giai phap ky thuat kha thi nhat cho `packages-first parallel migration`

Voi quyet dinh moi, trinh tu dung phai la:

## Pha 0 - dung legacy frontend lam reference, khong lam implementation target

1. Giu `frontend/src/` lam nguon doi chieu ve UX, auth flow, routing va guard behavior.
2. Chi hotfix legacy frontend khi can cho van hanh hoac parity verification.
3. Moi hang muc kien truc moi di vao `packages/web/src/`.

## Pha 1 - dung shared shell moi trong `packages/web/src/`

1. Tao `packages/web/src/config/buildTarget.js`.
2. Tao `packages/web/src/app/routeCatalog.js` va `navigationCatalog.js`.
3. Tao adapter seam ro rang cho `core` va `vip local backend`.
4. Dung lai route shell, nav gating va ability model theo boundary moi.

## Pha 2 - dua SaaS va VIP modules vao cung source moi

1. Tao feature folders `shared`, `saas`, `vip` trong `packages/web/src/features/`.
2. Dua VIP Internal Admin vao module `vip`; dua Central/Tenant Admin vao module `saas`.
3. Gate route va menu bang `BUILD_TARGET` + capability snapshot thay vi string checks roi rac.

## Pha 3 - parity va cutover

1. So sanh route behavior, payload assumptions, auth flow va layout giua `frontend/` va `packages/web/`.
2. Khi `saas` va `vip` builds o `packages/web/` dat on dinh, doi compose/workspace sang package track.
3. Sau cutover, legacy `frontend/` bi decommission thay vi tiep tuc ton tai nhu mot frontend fork thu hai.

---

## 9. Cau truc thu muc muc tieu trong phase chuyen tiep

```text
packages/web/src/
  config/
    buildTarget.js
  app/
    routeCatalog.js
    navigationCatalog.js
    surfaceGuards.js
  adapters/
    core/client.js
    vip/client.js
  features/
    shared/
      dashboard/
      stocks/
      whale/
      advisory/
      portfolio/
    saas/
      core-admin/
      tenant-admin/
    vip/
      organization/
      sub-users/
      core-connections/
      ai-prompts/
      usage-analytics/
  components/
    layout/
    guards/
    charts/
    data-display/
```

Dieu quan trong o day khong phai dep folder, ma la:

- moi feature co owner ro,
- shared components khong import nguoc variant logic,
- pages variant khong fork shell.

Legacy `frontend/` giu vai tro reference/fallback cho toi khi cutover xong.

---

## 10. Hard rules de tranh drift

1. Khong clone `frontend/` thanh `vip-frontend/`.
2. Khong viet hai router tach roi cho SaaS va VIP.
3. Khong de shared components import thang local VIP services.
4. Khong de browser VIP giu machine PAT cua `core`.
5. Khong dat React admin shell ben trong `vip-app` package.
6. Khong gate business semantics bang string checks ro rai trong component; moi check phai di qua build config hoac capability model.

---

## 11. Loi ich kinh te va van hanh

Phuong an nay cho 5 loi ich ro rang:

1. **Chi phi phat trien thap nhat:** shell, charts, forms, i18n, nav va state machine viet mot lan.
2. **Regression thap hon:** fix UI shell o mot noi se co cho ca SaaS va VIP.
3. **Dong bo nhanh hon:** khi nang cap chart/UX, VIP huong loi ngay khong can merge tay.
4. **Boundary sach hon:** khac biet nam o adapter va capabilities thay vi nam o fork codebase.
5. **San sang tach repo sau nay:** tach `packages/web` va `packages/vip-app` ma khong mat shared logic.

---

## 12. Rui ro va giai phap giam thieu

| Rui ro | Neu mac phai | Giam thieu |
|---|---|---|
| Shared source bi ro ri logic variant | Component chung day `if vip` khap noi | Dua variant logic vao route catalog, nav catalog, adapters va feature folders |
| VIP local admin lan vao central admin | Role va route nham lan | Tach route namespace: `/admin/core/*`, `/tenant-admin/*`, `/vip-admin/*` |
| Browser VIP goi thang `core` | Lo PAT / audit sai / kho revoke | Bat buoc browser goi local backend, local backend goi `core` |
| `manage all` tiep tuc ton tai qua lau | Khong scale duoc admin matrix | Chot capability snapshot va granular abilities som |
| Fork giua legacy va `packages/web` | UI drift, fix mot noi vo noi khac | Chi `packages/web` nhan work kien truc moi; legacy `frontend/` chi hotfix/parity cho toi cutover |

---

## 13. Acceptance criteria de coi huong nay da dung

Huong `1 frontend source` duoc coi la chot dung khi dat ca 7 dieu kien sau:

1. Co `buildTarget.js` trong `packages/web` va build ra duoc it nhat `saas` va `vip`.
2. Cung mot `App` shell phuc vu duoc ca hai build.
3. Route catalog phan loai duoc shared / saas / vip.
4. VIP local admin pages song trong cung source ma khong fork layout.
5. Central/Tenant Admin pages song trong cung source ma khong fork layout.
6. Browser VIP chi goi local backend cho local concerns.
7. Khong co frontend package thu hai duoc tao ra chi de copy UI.

---

## 14. Ket luan thuc dung

Neu muc tieu la **code 1 lan, tai su dung toi da, chi phi chuyen sang VIP thap nhat**, thi phuong an dung khong phai la:

- tach them mot frontend cho VIP,
- hay coi `vip-app` la mot ung dung web doc lap.

Phuong an dung la:

- `web` la **frontend shell duy nhat**,
- `vip-app` la **local backend/orchestrator package**,
- VIP va SaaS la **hai build variants** cua cung frontend source,
- `packages/web` la implementation track chinh cho kien truc moi, trong khi legacy `frontend/` chi ton tai toi luc cutover,
- su khac nhau duoc quan ly boi `BUILD_TARGET`, capability snapshot va API adapters.

Day la phuong an dat can bang tot nhat giua toc do, chi phi, boundary sach va kha nang scale sau nay.