# Staging FE deploy — local widget packages (2026-11-23)

- `bash scripts/deploy-staging.sh` that bai o `npm ci --legacy-peer-deps`: E401 `npm.pkg.github.com/.../engine-react@0.5.8`.
- Theo Owner request, dong goi engine tu `packages/web/node_modules` local:
  `npm pack ./node_modules/@vninvestcharts/engine-{core,drawing,react} --pack-destination ./vendor`
  → `engine-core-0.5.8.tgz`, `engine-drawing-0.5.7.tgz`, `engine-react-0.5.8.tgz` (khong dung ban 1.0.5 co san trong vendor).
- `package.json` + lock tro `file:vendor/...`; lock khong con URL GitHub Packages cho engine (verified bang grep).
- `docker build` truc tiep tu worktree `/tmp/wt-local-pkg/packages/web`, tag `vninvest-staging-frontend:latest`, khong truyen GITHUB_TOKEN → thanh cong.
- `compose up -d --no-deps frontend` → container running.
- Verify: `grep -rl corporate-actions /usr/share/nginx/html/assets` → `adapters-DzH2XvOq.js`; `https://docker.edusuccess.vn/` → 200; `corporate-actions` → 401 (fail-closed, can PAT).
- Worktree VPS `/tmp/wt-local-pkg` da remove + prune. PR #520 merged vao dev (Entry 617).
- Revert khi widget publish ban moi: doi 3 dong `package.json` ve version va chay `npm install --package-lock-only`.
