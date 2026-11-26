# GATES — broker-config-r1 (cập nhật sau R2, 2026-11-26)

> Mọi dòng có command + output thật. `CHƯA CHẠY` ghi rõ; không báo PASS giả (L-G02).

| Gate | Lệnh | Kết quả |
|---|---|---|
| Fail-before FE (R1) | `npx vitest run src/components/__tests__/soc-broker-r1.component.test.tsx` trên code trước R1 | **4 failed / 0 passed** (raw key, textarea `{}`, không có error i18n) |
| Fail-before harness | mock `useI18n` trả `t` mới mỗi render → `reload` đổi identity, effect chạy lại xoá error (L-F10) | Đổi `tVi` ổn định → xanh |
| FE component (sau R2) | `npx tsc --noEmit && npx vitest run soc-broker.component.test.tsx soc-broker-wave4.component.test.tsx soc-broker-r1.component.test.tsx --reporter=dot` | tsc **0** · **3 file / 11 test PASS** (gồm test 3 tab, mỗi broker schema riêng) |
| BE R1+R2 trên VPS | `docker exec vninvest-core-api python /app/src/manage.py test service_ops.tests.test_broker_config_r1 --verbosity 2 --noinput --keepdb` với `CORE_DATABASE_URL` trực tiếp `core-db:5432` | `Ran 10 tests … OK` (gồm `test_ssi_requires_client_id_api_key_api_secret`, `test_tcbs_requires_only_api_key`) |
| BE regression | cùng lệnh, label `test_soc_broker_config test_soc_broker_ops_wave4` | `Ran 21 tests … OK` (chạy ở vòng R1; R2 chỉ đổi schema key nên regression vẫn giữ) |
| Pre-push | `git push --force-with-lease origin HEAD:feat/broker-config-r1` | **36 PASS / 0 SKIP / 0 FAIL** mỗi lần push (kể cả sau rebase) |
| Deploy staging | `REPO_BRANCH=feat/broker-config-r1 bash /opt/vninvest/scripts/deploy-staging.sh` | HEAD VPS `b70c7a6c1`; BE container có `api_secret` trong `broker.py`; API health 200 |
| E2E staging (R2) | `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8081 npx playwright test tests/visual/broker-config-r1.spec.ts --project=chromium --reporter=line` (SSH tunnel tới `127.0.0.1:8080` trên VPS) | **2 passed / 13.8s** — 4 GET broker trả **200**, không có POST khi bấm Lưu với form rỗng |
| Ảnh E2E | `docs/evidence/broker-config-r1/e2e/broker-tabs-r2.png` | Đã **mở ảnh**: 3 tab DNSE/SSI/TCBS, DNSE active, 2 field có nhãn + helper + "Hiện giá trị", banner "Nhập đủ client_id / client_secret trước khi lưu.", **không còn textarea JSON** |

## Sự cố môi trường (đã xử lý / báo lại)

1. **Race deploy:** phiên khác nhiều lần deploy `dev` (`e7b67b151`, `afbf4eb91`, `42beb6a4f`) làm staging quay bản cũ → raw key / skeleton. Mỗi lần đã deploy lại branch R1/R2, verify HEAD + artifact rồi chạy lại E2E.
2. **Cert SNI sai:** `docker.edusuccess.vn` trả cert `CN=erp.edusuccess.vn` ⇒ Playwright `ERR_SSL_UNRECOGNIZED_NAME_ALERT`. Không sửa trong slice; dùng SSH tunnel `-L 8081:127.0.0.1:8080` để E2E vẫn chạy trên staging thật. **Ticket infra riêng.**
3. **Rate-limit login:** thử đăng nhập nhiều lần ⇒ "Thử lại sau 60 giây"; E2E dùng storageState từ `auth.setup` (testuser = superuser/staff), không login lại, không xoá cookie giữa chừng.
4. **G814/line-ending:** edit tool ghi CRLF vào file LF ⇒ pre-push chặn; đã chạy `node scripts/normalize-eol.mjs --fix` trước mỗi commit.
5. **Rebase conflict** ở `docs/CLAIMS.md` + `docs/CODE_CHANGE_AUDIT_LEDGER.md`: giữ entry của dev và Entry 654/655 của slice; đã restore sau một lần resolve nhầm phía conflict.

**CHƯA CHẠY:** `npm run build` riêng (build trong image Docker đã verify artifact), full `npm run test:components`, E2E firefox/webkit, BE toàn repo. FE vitest chạy trên máy agent (container frontend không có node_modules); BE test chạy trên VPS.

## Tái tạo nhanh

```bash
ssh -i "$HOME/.ssh/id_ed25519" root@14.225.255.47 \
  "cd /opt/vninvest && git fetch origin feat/broker-config-r1 && git reset --hard origin/feat/broker-config-r1 && REPO_BRANCH=feat/broker-config-r1 bash scripts/deploy-staging.sh"
ssh -i "$HOME/.ssh/id_ed25519" -L 8081:127.0.0.1:8080 -N root@14.225.255.47
cd packages/web && PLAYWRIGHT_BASE_URL=http://127.0.0.1:8081 npx playwright test tests/visual/broker-config-r1.spec.ts --project=chromium
```
