# B3 independent audit — @vninvestcharts/widget-pro@0.4.4 tarball (2026-11-11)

> Auditor B3, read-only. Plan: `docs/PLAN_WIDGET_BUMP_044_20261111.md` §6
> (file thực tế chỉ có 76 dòng, không có §7 — đối chiếu theo §6 root cause
> build fail: `register.js` trỏ `./pinescript/pine.worker.ts` nhưng package
> không ship `dist/pinescript/`).

## Verdict: PASS

Bản 0.4.4 fix đúng root cause: ship `dist/pinescript/pine.worker.js`
và `register.js`/`register.cjs` chỉ còn trỏ `.js`, không còn `.ts`.

## 1. Registry — 0.4.4 đã có

Lệnh (chạy từ `D:/Mujoco Projects/vninvest`, KHÔNG trong `packages/web`):

```powershell
npm view @vninvestcharts/widget-pro versions --registry=https://npm.pkg.github.com
```

Kết quả: `[ '0.4.1', '0.4.3', '0.4.4' ]` — 0.4.4 TỒN TẠI.

## 2. Tarball forensics

```powershell
mkdir C:\Temp\wverify044p
npm pack @vninvestcharts/widget-pro@0.4.4 --registry=https://npm.pkg.github.com --pack-destination=C:\Temp\wverify044p
tar -xzf C:\Temp\wverify044p\vninvestcharts-widget-pro-0.4.4.tgz -C C:\Temp\wverify044p
```

Tarball listing (npm notice): 7 files, unpacked 4.5 MB,
`dist/pinescript/pine.worker.js` 745.6 kB — TỒN TẠI, size 745571 bytes > 0.

| Check | Kết quả |
|---|---|
| `package/dist/pinescript/pine.worker.js` tồn tại, size > 0 | PASS — 745571 bytes |
| `dist/register.js` chứa `pine.worker.ts` | PASS — 0 hits |
| `dist/register.js` chứa `pine.worker.js` | PASS — 1 hit (`register.js:27491`: `new Worker(new URL("./pinescript/pine.worker.js", import.meta.url), { type: "module" })`) |
| `dist/register.cjs` chứa `pine.worker.ts` | PASS — 0 hits (`register.cjs:27512` trỏ `.js`) |
| Toàn bộ `dist/*.js,*.cjs` chứa `pine.worker.ts` | PASS — 0 hits |

## 3. package.json (tarball)

- `version`: `0.4.4`
- `dependencies`: `@vninvestcharts/engine-pro: 0.4.1`, `@vninvestcharts/widget: 0.4.3`
- `peerDependencies`: `react`/`react-dom` `^18 || ^19`

Lưu ý (không chặn): nested dep `@vninvestcharts/widget` là `0.4.3`,
thấp hơn pin top-level `0.4.4` của plan — npm sẽ hoist/dedupe bản top-level,
không gây lỗi build kiểu worker thiếu file. Ghi nhận để B8 re-audit sau
`npm install` đối chiếu `node_modules` thực tế.

## 4. Cleanup

- `C:\Temp\wverify044p` đã xóa toàn bộ sau verify (lệnh: `Remove-Item -Recurse -Force C:\Temp\wverify044p`).
- Không tạo script scan file rời — chỉ dùng lệnh inline, không có gì thêm để xóa.
- Repo: chỉ write đúng file này, không sửa gì khác.
