# RUN INTEGRATION TESTS — About Site: VNInvest Ecosystem Hub

**Ngày**: 2026-05-06  
**Mục tiêu**: danh sách test tích hợp để xác nhận about site hoạt động end-to-end, không chỉ build pass.

---

## 1. Test strategy

Test tích hợp phải cover 3 lớp:
1. public UI routing and locale,
2. data relay and security guardrails,
3. deploy and production smoke.

Không được dừng ở unit test hoặc type-check.

---

## 2. Local integration checks

### 2.1 Package build and lint

```powershell
cd packages/opencore-site
npm run lint
npm run build
```

Pass condition:
- exit code 0
- build output có `standalone` artifact
- không có missing import, missing type, or route config error

### 2.2 Locale shell smoke

Commands:
- mở `/vi`
- mở `/en`
- đổi locale bằng toggle

Pass condition:
- VI là default
- EN route hoạt động
- nav/footer/CTA vẫn đúng

### 2.3 Chart demo smoke

Commands:
- mở `/chart`
- chọn `VNM`
- chọn `FPT`
- xác nhận chart refresh

Pass condition:
- `VNBrokerChart` render đúng
- relay route `/api/bars/[symbol]` có request
- không có KLineCharts surface

### 2.4 Relay route smoke

Commands:

```powershell
curl http://localhost:3000/api/bars/VNM?tf=1d&from=2026-05-01T00:00:00.000Z&to=2026-05-06T00:00:00.000Z
curl http://localhost:3000/api/bars/ABC%3BDROP?tf=1d&from=2026-05-01T00:00:00.000Z&to=2026-05-06T00:00:00.000Z
curl http://localhost:3000/api/public/vnbroker-data?symbol=VNM&data_type=ohlcv&period=1M
```

Pass condition:
- valid symbol returns 200 + JSON
- invalid symbol returns 4xx
- cache header present
- rate limit can be exercised to 429

### 2.5 Pyodide playground smoke

Commands:
- mở `/vnbroker/playground`
- chạy preset example
- chạy sample fetch helper

Pass condition:
- script executes in browser
- output panel shows result
- browser network only hits same-origin relay

### 2.6 Blog and SEO smoke

Commands:
- mở `/blog`
- mở `/blog/<slug>`
- kiểm `/robots.txt` và sitemap

Pass condition:
- MDX renders
- metadata hợp lệ
- sitemap includes public pages

---

## 3. Production smoke

### 3.1 Build and deploy

- build Docker image `ghcr.io/vietdungiitb/vninvest-opencore-site:latest`
- deploy `opencore-site` service in Portainer
- wait for container healthcheck

### 3.2 Production curl checks

```powershell
curl -sk https://about.vninvest.edusuccess.vn/
curl -sk https://about.vninvest.edusuccess.vn/api/health
curl -sk https://about.vninvest.edusuccess.vn/api/bars/VNM?tf=1d&from=2026-05-01T00:00:00.000Z&to=2026-05-06T00:00:00.000Z
```

Pass condition:
- domain responds 200
- health endpoint responds 200
- relay endpoint responds 200

---

## 4. Evidence requirements

For every integration run capture:
- command output
- browser screenshot for UI checks
- network or payload snapshot for relay checks
- container health or Portainer screenshot for deploy checks
- residual risk note if any test is intentionally deferred

---

## 5. Suggested execution order

1. local lint/build
2. locale smoke
3. chart smoke
4. relay smoke
5. playground smoke
6. blog/SEO smoke
7. production deploy smoke

Do not skip chart or playground validation just because build passed.
