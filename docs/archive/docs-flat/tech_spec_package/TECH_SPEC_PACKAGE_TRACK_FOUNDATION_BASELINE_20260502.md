# TECH SPEC - Package Track Foundation Baseline

**Ngày**: 2026-05-02  
**Trạng thái**: Draft frozen for baseline implementation  
**Mục đích**: Đặc tả kỹ thuật chi tiết cho baseline đầu tiên của `packages/core`, `packages/web` và `shared`.

---

## 1. Mục tiêu kỹ thuật

Baseline này phải giải quyết đồng thời ba bài toán kỹ thuật:

1. tạo một `core` package importable và có execution entrypoints ở mức stub,
2. tạo một `web` shared shell có catalog hóa route/navigation và backend adapter seam rõ ràng,
3. khóa ba contract SSOT đầu tiên để các package không drift ngay từ bước đầu.

---

## 2. `packages/core` baseline specification

## 2.1 Python package manifest

`packages/core/pyproject.toml` phải có các đặc tính sau:

1. package name: `vninvest-core`
2. Python floor: `>=3.13`
3. build backend: `setuptools.build_meta`
4. source layout: `packages/core/backend/src`
5. dependency families:
   - Django/DRF cho API edge,
   - Celery/Redis cho async services,
   - psycopg cho PostgreSQL,
   - pandas cho future facts/materialization paths.

`pyproject.toml` ở slice này chưa cần pin toàn bộ dependency transitive như production lockfile, nhưng phải phản ánh đúng ecosystem mục tiêu của `core`.

## 2.2 Source layout

Source tree mục tiêu:

```text
packages/core/
  pyproject.toml
  docker-compose.core.yml
  backend/
    src/
      vninvest_core/
        __init__.py
        app_manifest.py
        api_stub.py
        worker_stub.py
        beat_stub.py
        contracts/
          __init__.py
          access/
          market/
          operator/
          partner/
```

## 2.3 App manifest shape

`app_manifest.py` phải export một object/dict tối thiểu:

```python
CORE_APP_MANIFEST = {
    "package": "vninvest-core",
    "version": "0.1.0",
    "service_names": [
        "core-api",
        "core-worker",
        "core-beat",
    ],
    "contract_namespaces": [
        "access",
        "market",
        "operator",
        "partner",
    ],
}
```

Mục đích của manifest là cho IDE, validation scripts và compose stubs có một source thống nhất về identity và topology của package.

## 2.4 Stub entrypoints

### `api_stub.py`

Phải cung cấp entrypoint `python -m vninvest_core.api_stub` và trả về health/manifest proof ở mức stub.

### `worker_stub.py`

Phải cung cấp entrypoint `python -m vninvest_core.worker_stub` để phản ánh boundary Celery worker tương lai.

### `beat_stub.py`

Phải cung cấp entrypoint `python -m vninvest_core.beat_stub` để phản ánh boundary scheduler tương lai.

Các stub này chưa cần business logic thật; nhiệm vụ của chúng là tạo baseline runnable/importable cho compose topology và validation.

## 2.5 Contract folders inside `core`

Các folder tối thiểu phải tồn tại:

1. `contracts/access`
2. `contracts/market`
3. `contracts/operator`
4. `contracts/partner`

Chúng được dùng để neo ownership theo boundary, không phải nơi đặt JSON contracts dùng chung cho mọi package. JSON contracts cross-package vẫn nằm ở `shared/api-contracts`.

## 2.6 Compose topology stub

`packages/core/docker-compose.core.yml` phải encode topology sau:

| Service | Vai trò | Notes |
|---|---|---|
| `core-db` | PostgreSQL stub cho source-of-record | image chuẩn, env names rõ |
| `core-redis` | Redis stub cho cache/broker/streams | image chuẩn |
| `core-api` | API edge tương lai | command gọi `vninvest_core.api_stub` |
| `core-worker` | async worker tương lai | command gọi `vninvest_core.worker_stub` |
| `core-beat` | scheduler tương lai | command gọi `vninvest_core.beat_stub` |

Điều bắt buộc:

1. service names phải khớp với manifest,
2. env families phải phản ánh `POSTGRES_*`, `REDIS_URL`, `CORE_ENV`,
3. dependency graph phải thể hiện `api/worker/beat` phụ thuộc vào `db` và `redis`.

---

## 3. `shared/api-contracts` specification

## 3.1 Build target contract

### File

`shared/api-contracts/build-target.contract.json`

### Purpose

Khóa danh sách build targets và compile-time semantics dùng chung giữa package tooling và frontend shell.

### Required fields

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "VNInvest Build Target Contract",
  "type": "object",
  "required": ["defaultTarget", "allowedTargets", "envKey"],
  "properties": {
    "defaultTarget": { "const": "saas" },
    "allowedTargets": {
      "type": "array",
      "items": { "enum": ["community", "saas", "vip"] }
    },
    "envKey": { "const": "REACT_APP_BUILD_TARGET" }
  }
}
```

## 3.2 Capability bootstrap contract

### File

`shared/api-contracts/capability-bootstrap.contract.json`

### Purpose

Khóa response shape mà frontend shell dùng để bootstrap abilities, navigation gating và surface visibility.

### Required top-level keys

1. `principal`
2. `build`
3. `abilities`
4. `navigation`
5. `surfaces`

### Example payload

```json
{
  "principal": {
    "mode": "human",
    "user_id": 42,
    "username": "operator"
  },
  "build": {
    "target": "saas",
    "plan": "pro"
  },
  "abilities": [
    { "action": "read", "subject": "Dashboard" },
    { "action": "manage", "subject": "all" }
  ],
  "navigation": {
    "visible_groups": ["workspace", "signals", "system"]
  },
  "surfaces": {
    "show_admin_ops": true,
    "show_vip_shell": false
  }
}
```

## 3.3 Session payload contract

### File

`shared/api-contracts/session-payload.contract.json`

### Purpose

Khóa session shape tối thiểu để `packages/web` và `packages/vip-app` cùng diễn giải principal và tenant scope theo một cách.

### Required top-level keys

1. `session_id`
2. `principal`
3. `tenant`
4. `build_target`
5. `issued_at`

### Example payload

```json
{
  "session_id": "sess_20260502_demo",
  "principal": {
    "kind": "human",
    "user_id": 42,
    "username": "operator"
  },
  "tenant": {
    "tenant_id": null,
    "tenant_slug": null,
    "service_account_id": null
  },
  "build_target": "saas",
  "issued_at": "2026-05-02T10:00:00+07:00"
}
```

---

## 4. `packages/web` shared shell specification

## 4.1 Package metadata

`packages/web/package.json` ở slice baseline phải được nâng lên từ placeholder thành package metadata thật với các đặc tính sau:

1. `type: module` để Node import được ESM shell files.
2. `exports` map tối thiểu cho `buildTarget`, `routeCatalog`, `navigationCatalog`, `core adapter`, `vip-app adapter`.
3. `scripts.check:shell` để validate imports/exports của package shell.
4. version hiện tại vẫn có thể là `0.1.0`, nhưng description phải phản ánh đây là `shared frontend shell baseline`.

## 4.1A Unified UI template governance

Mọi UI surface mới trong `packages/web` thuộc phần nâng cấp này phải tuân thủ một chuẩn template chung thống nhất thay vì tự thiết kế riêng theo từng route.

### Hard rules

1. Template chuẩn phải ưu tiên giao diện giàu thông tin: page shell phải mang đủ session, status, metrics, actions và data trong một viewport hợp lý.
2. Mật độ bố cục phải ở mức compact: margin ngoài, padding panel, khoảng cách giữa section, khoảng cách giữa label-control và khoảng cách giữa list rows phải thấp theo một chuẩn chung, không được drift sang style quá thoáng.
3. Mọi page mới phải reuse cùng một grammar bố cục nền: header ngắn, status band hoặc metrics band, action zone gần data zone, danh sách, form và audit panel đặt theo nhịp nhất quán.
4. Sự khác biệt giữa các route chỉ được nằm ở capability, data shape và thao tác đặc thù; không được tạo visual language mới làm đội code hoặc auditor phải học lại template từ đầu.
5. Nếu một surface buộc phải lệch template chung vì responsive hoặc nghiệp vụ đặc biệt, deviation đó phải được ghi rõ trong taskboard và audit evidence.

## 4.2 Route catalog contract

### File

`packages/web/src/app/routeCatalog.js`

### Required item shape

```js
{
  id: "dashboard",
  path: "/dashboard",
  titleKey: "routes.dashboard",
  group: "workspace",
  buildTargets: ["community", "saas", "vip"],
  requiredCapabilities: ["workspace.dashboard.read"],
  adapter: "core",
  status: "active"
}
```

### Rules

1. `buildTargets` dùng enum từ build target contract.
2. `requiredCapabilities` là semantic keys mức sản phẩm, không bị ràng buộc cứng với implementation CASL hiện tại.
3. `adapter` chỉ được nhận `core` hoặc `vip-app` ở baseline này.
4. Route catalog phải bao phủ tối thiểu các nhóm route: `workspace`, `signals`, `system`, `admin`, `vip-local`.

## 4.3 Navigation catalog contract

### File

`packages/web/src/app/navigationCatalog.js`

### Required group shape

```js
{
  id: "signals",
  labelKey: "navigation.signals",
  buildTargets: ["saas", "vip"],
  requiredCapabilities: ["signals.group.read"],
  items: ["ai-advisory", "whale-alerts", "watchlist"]
}
```

### Rules

1. `items` phải tham chiếu `routeCatalog` qua `route id`, không duplicate full route objects.
2. `navigationCatalog` phải encode visibility theo build target và capability ở cùng một nơi.
3. `TopNav` tương lai phải đọc từ catalog này thay vì hardcode arrays riêng.

## 4.4 Adapter seam specification

### Files

1. `packages/web/src/adapters/core/coreAdapter.js`
2. `packages/web/src/adapters/vip-app/vipAppAdapter.js`

### Shared adapter interface

```js
{
  adapterId: "core",
  displayName: "Core API",
  resolveBaseUrl(env),
  getBuildMeta(env),
  getCapabilityBootstrapEndpoint(),
  getSessionPayloadEndpoint(),
  getHealthcheckEndpoint()
}
```

### Adapter rules

1. `core` adapter phản ánh central backend/global APIs.
2. `vip-app` adapter phản ánh local control plane APIs cho browser VIP.
3. Shell phía trên chỉ biết adapter interface, không biết concrete backend internals.
4. Không adapter nào được import logic từ legacy `frontend/src/api/client.js`.

## 4.5 Shell package entrypoint

### File

`packages/web/src/index.js`

### Purpose

Export một surface nhỏ, ổn định để validation script và các package khác import được:

1. `BUILD_TARGETS` và helpers từ `config/buildTarget.js`
2. `routeCatalog`
3. `navigationCatalog`
4. `coreAdapter`
5. `vipAppAdapter`
6. page registry và các route-level pages đã được duyệt.

## 4.6 Validation script

`packages/web` nên có một script validation dùng Node để import `src/index.js`, kiểm tra:

1. route ids unique,
2. navigation items tham chiếu route ids hợp lệ,
3. adapter ids unique,
4. build targets chỉ dùng giá trị canonical.

---

## 5. Compatibility rules with current runtime semantics

## 5.1 Capability compatibility

Capability contract mới phải map được về current runtime semantics đã có trong legacy frontend:

1. `abilities` phải chuyển đổi được sang `createAbilityFromRules(...)`.
2. `build.plan` phải tương thích với khái niệm `userPlan` hiện có trong `PortfolioContext`.
3. `principal` phải đủ thông tin để dựng `userIdentity` mức tối thiểu.

## 5.2 Navigation compatibility

Navigation contract mới phải giải quyết đúng những gì `TopNav` đang hardcode hôm nay:

1. nhóm menu `signals`, `portfolio`, `system`,
2. gating `admin-ops`,
3. gating `ai-advisory`,
4. phân biệt `community`, `saas`, `vip` từ compile-time target.

## 5.3 Session compatibility

Session payload contract mới phải đủ để tương lai đại diện cả:

1. human session từ central `core`,
2. VIP browser session đi qua `vip-app` local backend,
3. delegated actor context khi `vip-app` gọi `core` bằng machine credential.

---

## 6. Validation requirements

1. `packages/core/backend/src` phải compile pass bằng Python.
2. `packages/web` phải pass `check:shell` bằng Node.
3. `module_tree_full.md` phải ghi nhận toàn bộ files baseline mới.
4. Ledger và progress dashboard phải liệt kê đầy đủ file list và validation commands.

---

## 7. Kết luận

Baseline này chỉ được coi là đạt khi ba điều cùng đúng:

1. `core` import được và có topology stub rõ ràng,
2. `web` có shared shell artifacts thật thay vì placeholder,
3. `shared` đã trở thành SSOT của ba contracts đầu tiên.

Nếu thiếu một trong ba điều đó thì package track vẫn chưa thoát khỏi trạng thái scaffold.