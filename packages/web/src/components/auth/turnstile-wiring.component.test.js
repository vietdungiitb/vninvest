/**
 * Contract: 2 khoa Turnstile phai that su toi duoc container.
 *
 * Vua co mot P0 "production co anti-spam nhung chay fail-open" vi 2 ly do
 * doc lap nhau:
 *   1. `TurnstileWidget` doc `process.env.REACT_APP_*` — app Vite nen env do
 *      khong bao gio ton tai -> luon roi ve test key cua Cloudflare.
 *   2. Co fix o FE nhung key chua bao gio duoc truyen qua build. Da xac nhan
 *      `TurnstileWidget.js:26` doc dung `import.meta.env.VITE_TURNSTILE_SITE_KEY`,
 *      nhung `docker-compose.dev.yml` `frontend.build.args` khong co no va
 *      `packages/web/Dockerfile` khong khai bao `ARG VITE_TURNSTILE_SITE_KEY`
 *      -> Vite khong co gi de inject. Dat key vao env van khong co tac dung.
 *   3. BE `core-api` service cung khong truyen `TURNSTILE_SECRET_KEY`.
 *
 * Test nay khoa ca 3 duong day. Doc source truc tiep vi day la contract giua
 * file cau hinh, khong phai runtime co the import.
 *
 * Dot path: `components/auth/turnstile-wiring.component.test.js`
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, test } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
// HERE = <repo>/packages/web/src/components/auth -> len goc can 5 cap len
const REPO = join(HERE, "..", "..", "..", "..", "..");
const read = (...p) => readFileSync(join(REPO, ...p), "utf8");

const COMPOSE = read("docker-compose.dev.yml");
const DOCKERFILE = read("packages", "web", "Dockerfile");
const ENV_EXAMPLE = read("compose.dev.env.example");
const SETTINGS = read("packages", "core", "backend", "src", "vninvest_core", "settings.py");
const WIDGET = read("packages", "web", "src", "components", "auth", "TurnstileWidget.js");
// Comment trong file van nhac lai `process.env.REACT_APP_*` la cach CU sai — chi kiem
// tra CODE thuc thi, bo qua comment.
const WIDGET_CODE = WIDGET.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("tw-wire — Turnstile env wiring", () => {
  test("FE doc site key tuong Vite (`import.meta.env`), khong phai process.env.REACT_APP_*", () => {
    // Code thuc tai la `viteEnv.VITE_TURNSTILE_SITE_KEY` voi `viteEnv = import.meta.env`
    // (TurnstileWidget.js:23,26). Literal `import.meta.env.VITE_TURNSTILE_SITE_KEY` chi
    // xuat hien trong docblock, nen khong assert vao comment.
    expect(WIDGET_CODE).toMatch(/const viteEnv = import\.meta\.env/);
    expect(WIDGET_CODE).toMatch(/\.VITE_TURNSTILE_SITE_KEY/);
    expect(WIDGET_CODE).not.toMatch(/process\.env\.REACT_APP_/);
  });

  test("Dockerfile khai bao ARG + ENV VITE_TURNSTILE_SITE_KEY truoc `npm run build`", () => {
    // ARG/ENV phai nam TRUOC `npm run build`: Vite chi inject env luc build.
    const argIdx = DOCKERFILE.indexOf("ARG VITE_TURNSTILE_SITE_KEY");
    const envIdx = DOCKERFILE.indexOf("ENV VITE_TURNSTILE_SITE_KEY=");
    const buildIdx = DOCKERFILE.indexOf("RUN npm run build");
    expect(argIdx).toBeGreaterThan(-1);
    expect(envIdx).toBeGreaterThan(-1);
    expect(buildIdx).toBeGreaterThan(-1);
    expect(argIdx).toBeLessThan(buildIdx);
    expect(envIdx).toBeLessThan(buildIdx);
  });

  test("compose truyen VITE_TURNSTILE_SITE_KEY vao frontend build args", () => {
    const frontend = COMPOSE.slice(COMPOSE.indexOf("\n  frontend:"));
    expect(frontend).toMatch(/VITE_TURNSTILE_SITE_KEY:\s*\$\{VITE_TURNSTILE_SITE_KEY/);
  });

  test("compose truyen TURNSTILE_SECRET_KEY vao service core-api", () => {
    const api = COMPOSE.slice(COMPOSE.indexOf("\n  core-api:"));
    expect(api).toMatch(/TURNSTILE_SECRET_KEY:\s*\$\{TURNSTILE_SECRET_KEY/);
  });

  test("compose.dev.env.example khai bao ca 3 khoa", () => {
    expect(ENV_EXAMPLE).toMatch(/^TURNSTILE_SECRET_KEY=/m);
    expect(ENV_EXAMPLE).toMatch(/^STRICT_TURNSTILE_ENFORCEMENT=/m);
    expect(ENV_EXAMPLE).toMatch(/^VITE_TURNSTILE_SITE_KEY=/m);
  });

  test("env rong = CHUA DAT, khong phai False (khong vo hieu hoa strict o production)", () => {
    // `${VAR:-}` trong compose tao chuoi rong. Neu settings dung
    // `os.environ.get(K, default)` thi chuoi rong thang `default` va
    // `.lower() in ('true',...)` = False => TAT strict o production.
    const line = SETTINGS.slice(SETTINGS.indexOf("STRICT_TURNSTILE_ENFORCEMENT = "));
    expect(line).toMatch(/os\.environ\.get\('STRICT_TURNSTILE_ENFORCEMENT'\)\s*or/);
  });

  test("khong co secret that trong file commit", () => {
    for (const [name, src] of [["compose.dev.env.example", ENV_EXAMPLE]]) {
      expect(src, `${name} phai la placeholder`).not.toMatch(
        /^TURNSTILE_SECRET_KEY=0x[\w-]{10,}/m,
      );
      expect(src, `${name} phai la placeholder`).not.toMatch(
        /^VITE_TURNSTILE_SITE_KEY=0x[\w-]{10,}/m,
      );
    }
  });
});
