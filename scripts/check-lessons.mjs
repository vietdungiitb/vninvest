/**
 * scripts/check-lessons.mjs — co bang cho `docs/LESSONS/`.
 *
 * ⚠ VÌ SAO FILE NÀY TỒN TẠI (2026-10-10): `docs/LESSONS/` của repo này đã có
 * 31 lesson từ lâu, **nhưng không có gì kiểm**. Quy tắc "1 file ≤ 120 dòng",
 * "tổng ≤ 40 lesson", "INDEX phải khớp thực tế" chỉ nằm trong văn bản — không
 * có lệnh nào exit khác 0. Đo thật ngay khi viết file này:
 *
 *   - `frontend.md` = **128 dòng** (vượt C1) — không ai bị chặn.
 *   - `INDEX.md` §1.5 ghi **17 lesson**, thực tế **31** — lệch 14, không ai bị chặn.
 *
 * ⇒ Đây chính là hazard "Procedure beats prose" của skill `agent-lessons`: quy
 * tắc viết ra không bảo vệ được gì. Chỉ một lệnh exit khác 0 mới bảo vệ được.
 *
 * Nguồn mẫu (adapt, KHÔNG copy): `vnbroker/scripts/check_lessons.py` (Python) và
 * `vninvestcharts-widget/scripts/check-lessons.cjs`. Bản này viết bằng Node cho
 * khớp stack repo này (`packages/web/scripts/*.mjs` + `scripts/*.mjs`).
 *
 * ⚠ KHÁC BIỆT CÓ CHỦ ĐÍCH so với bản Python — KHÔNG phải lỗi:
 *
 *   1. **Lesson ID của repo này KHÔNG đồng nhất.** `multi-agent.md` dùng
 *      `## L-001`, các file còn lại dùng `## L-F01`. Regex của bản Python là
 *      `^## L-[A-Z]\d+` ⇒ nó **BỎ SÓT 8/31 lesson** của `multi-agent.md` mà
 *      không báo gì. Bản này nhận **cả hai**: `L-001` và `L-F01`.
 *      Sau này nếu chuẩn hoá ID thì thu hẹp regex, **đừng** thu hẹp khi chưa đổi file.
 *   2. Tự loại BOM + quy đổi CRLF khi đếm dòng. `Get-Content | Measure-Object -Line`
 *      **bỏ dòng trống** ⇒ lệch 10–29 dòng/file so với gate này. Hai phương pháp
 *      cho hai con số khác nhau — dùng gate này khi đối chiếu.
 *   3. Self-test **loại `GIT_*` khỏi env** khi spawn (lesson 17 của `agent-lessons`:
 *      git hook export `GIT_DIR` cho mọi tiến trình con ⇒ self-test "17/17 PASS khi
 *      gõ tay, FAIL dưới hook"). Ở đây chưa gọi git, nhưng để sẵn để sau này thêm
 *      kiểm tra không âm cầm môi trường sạch.
 *
 * Exit code:
 *   0  sạch
 *   1  có vi phạm
 *   2  KHÔNG verify được (thiếu thư mục / không đọc được) — TUYỆT ĐỐI không đọc
 *      là PASS. Việc có số liệu nửa vời, đọc báo cáo không đúng, thì còn tệ hơn
 *      là gate im lặng.
 *
 * Dùng:
 *   node scripts/check-lessons.mjs
 *   node scripts/check-lessons.mjs --dir docs/LESSONS
 *   node scripts/check-lessons.mjs --self-test
 */
import { readdirSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DIR = join(REPO, "docs", "LESSONS");
const INDEX = "INDEX.md";

// Ngưỡng lấy từ `docs/LESSONS/INDEX.md` §1.2 — sửa ở CẢ HAI nơi.
export const C1_MAX_LINES = 120;
export const C2_MAX_LESSONS = 40;

/**
 * `^## L-(?:[A-Z]+)?\d+` — nhận CẢ `L-001` (multi-agent.md) LẪN `L-F01` (file khác).
 *
 * ⚠ KHÔNG khớp mẫu format trong INDEX §1.4 (`## L-XX:`) vì `XX` không phải chữ số.
 * ⚠ KHÔNG khớp `## §1.x`.
 */
const LESSON_HEADING = /^## L-(?:[A-Z]+)?\d+\b/gm;

/** Bỏ BOM, quy đổi CRLF, bỏ dòng trống cuối. KHÔNG dùng `Measure-Object -Line`. */
function countNonBlankLines(text) {
  const t = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\n+$/, "");
  if (!t) return 0;
  return t.split("\n").filter((l) => l.trim()).length;
}

function lessonIds(text) {
  return (text.match(LESSON_HEADING) || []).map((m) => m.replace(/^##\s*/, ""));
}

function readUtf8(path) {
  // `readFileSync(p, "utf8")` KHÔNG tự bỏ BOM cho `startsWith` kiểm tra ở
  // countNonBlankLines — hàm đó đã tự lstrip. Ném lỗi nếu không decode được.
  return readFileSync(path, "utf8");
}

export function check(directory) {
  const problems = [];
  let files;

  try {
    files = readdirSync(directory)
      .filter((f) => f.endsWith(".md"))
      .sort();
  } catch (err) {
    if (err && err.code === "ENOENT") {
      console.error(`FAIL: READ  khong tim thay ${directory} - KHONG verify duoc.`);
      return 2;
    }
    console.error(`FAIL: READ  khong doc duoc ${directory}: ${err.message}`);
    return 2;
  }

  if (files.length === 0) {
    console.error(`FAIL: READ  ${directory} khong co file .md nao - KHONG verify duoc.`);
    return 2;
  }

  const perFile = new Map();
  let total = 0;

  for (const name of files) {
    const path = join(directory, name);
    let text;
    try {
      text = readUtf8(path);
    } catch (err) {
      problems.push(`READ     ${name} khong doc duoc (UTF-8?): ${err.message}`);
      continue;
    }
    const lines = countNonBlankLines(text);
    const lessons = name === INDEX ? 0 : lessonIds(text).length;
    perFile.set(name, { lines, lessons, ids: name === INDEX ? [] : lessonIds(text) });

    if (lines > C1_MAX_LINES) {
      problems.push(`C1       ${name} co ${lines} dong > ${C1_MAX_LINES} - tach them roi`);
    }
    if (name !== INDEX) total += lessons;
  }

  if (total > C2_MAX_LESSONS) {
    problems.push(
      `C2       tong ${total} lesson > ${C2_MAX_LESSONS} - gop lesson trung lap, KHONG them file`,
    );
  }

  // ---------------------------------------------------------------- DRIFT
  const indexPath = join(directory, INDEX);
  if (!files.includes(INDEX)) {
    problems.push(`MISSING  khong co ${INDEX} trong ${directory}`);
  } else {
    const idx = readUtf8(indexPath);
    // `T[^:*\n]{0,12}:` chiu ca dau. Regex literal `Tổng` that bai neu dau
    // bi mat o noi nao, va mot check DRIFT im lang tuong duong voi KHONG co check.
    const declared = idx.match(/\*\s*T[^:*\n]{0,12}:\s*(\d+)\s*lesson/);
    if (!declared) {
      // ⚠ BẮT BUỘC có khai báo. Đo được 2026-10-10: `docs/LESSONS/INDEX.md` của
      // repo này liệt kê lesson theo file nhưng **không** có dòng tổng ⇒ regex
      // không khớp ⇒ nhánh DRIFT **im lặng bỏ qua**, trong khi thực tế §1.5 ghi
      // 17 lesson và thực tế là 31. Đó chính là "check im lặng = không có check".
      problems.push(
        `DRIFT    ${INDEX} §1.5 khong khai tong so lesson (can dong "**Tổng: N lesson**")`,
      );
    } else if (Number(declared[1]) !== total) {
      problems.push(
        `DRIFT    ${INDEX} §1.5 ghi tong ${declared[1]} lesson, thuc te la ${total}`,
      );
    }

    const linked = new Set([...idx.matchAll(/\]\(\.\/([^)]+\.md)\)/g)].map((m) => m[1]));
    for (const name of files) {
      if (name === INDEX) continue;
      if (!linked.has(name)) problems.push(`DRIFT    ${name} khong duoc ke trong ${INDEX} §1.5`);
    }

    const realIds = new Set();
    for (const [, info] of perFile) for (const id of info.ids) realIds.add(id);
    for (const cited of new Set(idx.match(/\bL-(?:[A-Z]+)?\d+\b/g) || [])) {
      if (!realIds.has(cited)) {
        problems.push(`DRIFT    ${INDEX} tro toi ${cited} - khong ton tai trong bat ky lesson file`);
      }
    }
  }

  if (problems.length) {
    for (const p of problems) console.error(`  ${p}`);
    console.error(`\ncheck-lessons: ${problems.length} loi.`);
    return 1;
  }

  const detail = [...perFile.entries()]
    .filter(([n]) => n !== INDEX)
    .map(([n, i]) => `${n} ${i.lines}d/${i.lessons}bai`)
    .join(" · ");
  console.log(
    `  check-lessons: ${files.length} file | ${total}/${C2_MAX_LESSONS} lesson | ${detail} - sach.`,
  );
  return 0;
}

// ------------------------------------------------------------------ self-test
// Self-test mà KHÔNG có case nào FAIL thì KHÔNG chứng minh được gì.
// Mỗi case chạy gate trên bản sao tạm và assert exit KHÁC 0.

const GOOD_INDEX = [
  "# idx",
  "",
  "## §1.5",
  "",
  "| [`a.md`](./a.md) | L-E01 |",
  "",
  "**Tổng: 2 lesson**",
  "",
].join("\n");
const GOOD_A = "## L-E01: a\n\nx\n\n## L-E02: b\n\ny\n";

function build(files) {
  const dir = mkdtempSync(join(tmpdir(), "check-lessons-"));
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), body, "utf8");
  }
  return dir;
}

function runSelf(args) {
  // ⚠ Loại `GIT_*`: git hook export chúng cho mọi tiến trình con. Self-test mà
  // phụ thuộc môi trường của người gọi thì "PASS khi gõ tay, FAIL dưới hook".
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.startsWith("GIT_")) delete env[k];
  const res = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...args], {
    encoding: "utf8",
    env,
    shell: false,
  });
  return { code: res.status ?? -1, out: `${res.stdout || ""}${res.stderr || ""}` };
}

export function selfTest() {
  console.log("check-lessons SELF-TEST - chay tren ban sao tam, assert gate BAT\n");
  let failures = 0;
  let totalCases = 0;

  const probe = (name, files, expect) => {
    totalCases += 1;
    const dir = build(files);
    const { code, out } = runSelf(["--dir", dir]);
    rmSync(dir, { recursive: true, force: true });
    const ok = expect == null ? code === 0 : code !== 0 && out.includes(expect);
    if (ok) {
      console.log(`  ok   ${name}  exit=${code}`);
    } else {
      failures += 1;
      const want = expect == null ? "exit 0" : `exit != 0 chua '${expect}'`;
      console.log(`  FAIL  ${name}\n        mong doi ${want}, nhan exit=${code}\n${out.trim()}`);
    }
  };

  const good = { [INDEX]: GOOD_INDEX, "a.md": GOOD_A };

  // CONTROL - khong co nay, mot gate hong van bao "tat ca case PASS".
  probe("CONTROL: mau sach", good, null);

  probe("C1: file 121 dong", { ...good, "a.md": GOOD_A + "x\n".repeat(119) }, "C1");
  probe("C1: INDEX 121 dong", { ...good, [INDEX]: GOOD_INDEX + "x\n".repeat(119) }, "C1");

  const many = { [INDEX]: "# idx\n\n**Tổng: 41 lesson**\n" };
  for (let i = 1; i <= 41; i += 1) many[`f${i}.md`] = `## L-G${String(i).padStart(2, "0")}: t\n\nx\n`;
  probe("C2: 41 lesson", many, "C2");

  // ID hai kieu deu phai dem: `L-001` va `L-F01`. Bản Python bo sot `L-001`.
  probe(
    "DRIFT: ca 2 kieu ID deu duoc dem",
    {
      [INDEX]: "# idx\n\n| [`a.md`](./a.md) | L-001 |\n| [`b.md`](./b.md) | L-F01 |\n\n**Tổng: 2 lesson**\n",
      "a.md": "## L-001: chuan\n\nx\n",
      "b.md": "## L-F01: chuan\n\nx\n",
    },
    null,
  );

  probe(
    "DRIFT: INDEX khai tong 99",
    { ...good, [INDEX]: GOOD_INDEX.replace("2 lesson", "99 lesson") },
    "DRIFT",
  );
  probe(
    "DRIFT: lesson file bi bo qua khoi INDEX",
    {
      ...good,
      "b.md": "## L-E03: c\n\nx\n",
      [INDEX]: GOOD_INDEX.replace("**Tổng: 2", "**Tổng: 3"),
    },
    "DRIFT",
  );
  probe(
    "DRIFT: INDEX tro toi lesson khong ton tai",
    { ...good, [INDEX]: GOOD_INDEX.replace("L-E01", "L-Z99") },
    "DRIFT",
  );
  probe("MISSING: thieu INDEX.md", { "a.md": GOOD_A }, "MISSING");

  // ⚠ Case nay chung minh fix "DRIFT im lang": INDEX khong khai tong ⇒ gate BAO
  // loi. Neu quay lai thanh `if (declared)` thi case nay FAIL ⇒ gate bi mo lai.
  probe(
    "DRIFT: INDEX khong khai tong so lesson",
    { ...good, [INDEX]: "# idx\n\n| [`a.md`](./a.md) | L-E01 |\n" },
    "DRIFT",
  );

  const emptyDir = mkdtempSync(join(tmpdir(), "check-lessons-empty-"));
  probe("READ: thu muc rong", {}, "khong co file");
  rmSync(emptyDir, { recursive: true, force: true });

  // "Khong verify duoc" la exit 2, TUYET DOI khong phai exit 0.
  totalCases += 1;
  const ghost = join(tmpdir(), "check-lessons-does-not-exist-9d3f");
  rmSync(ghost, { recursive: true, force: true });
  const { code: ghostCode } = runSelf(["--dir", ghost]);
  if (ghostCode === 2) {
    console.log("  ok   EXIT 2: thu muc khong ton tai  exit=2");
  } else {
    failures += 1;
    console.log(`  FAIL  EXIT  thu muc khong ton tai phai tra 2, nhan ${ghostCode}`);
  }

  if (failures) {
    console.error(
      `\ncheck-lessons SELF-TEST FAILED: ${failures}/${totalCases} case. Gate khong duoc tin.`,
    );
    return 1;
  }
  console.log(`\ncheck-lessons SELF-TEST PASS: ${totalCases} case theo dac ta.`);
  return 0;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) return selfTest();
  const dirIdx = argv.indexOf("--dir");
  const directory = dirIdx >= 0 && argv[dirIdx + 1] ? argv[dirIdx + 1] : DEFAULT_DIR;
  return check(directory);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exit(main());
}
