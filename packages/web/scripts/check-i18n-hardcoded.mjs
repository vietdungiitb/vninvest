#!/usr/bin/env node
/**
 * R5.2 / B2 — cổng gate chuỗi tiếng Việt hardcode.
 *
 * Vì sao cần cổng riêng:
 *   `i18next-scanner` không phát hiện được chuỗi hardcode trong JSX, và bản
 *   cấu hình cũ còn exit 0 dù parse lỗi — tức gate không bắt được gì. Cổng này
 *   quét đúng phạm vi và **exit 1** khi tìm thấy chuỗi, nên có thể gắn vào
 *   `check:shell` và có tác dụng thật.
 *
 * Phạm vi mặc định: trang `/ai-advisory`. Truyền thư mục khác làm tham số thứ
 * nhất, ví dụ `node scripts/check-i18n-hardcoded.mjs src/components/admin`.
 *
 * Bắt được 2 dạng:
 *   1. string literal chứa tiếng Việt:  `'Xóa tư vấn'`
 *   2. JSX text node chứa tiếng Việt:    <span>Xóa tư vấn</span>
 *      (dạng 2 trước đây bị bỏ sót hoàn toàn — tìm thấy 4 node trong
 *      `WhaleBubbleChart.jsx` chỉ khi đọc tay file)
 *
 * Bỏ qua (có chủ đích):
 *   - dòng đã gọi `t(...)` hoặc có `defaultValue` — pattern fallback hợp lệ
 *   - dòng khai báo `defaultLabel` / `defaultDescription` — dữ liệu fallback
 *     cho pattern `t(key, { defaultValue: defaultLabel })`
 *   - dòng chứa `className` / `class=`
 *   - dòng comment (`*`, `//`, `<!--`)
 *   - file test
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const VI_REGEX = /[\u00C0-\u1EF9]/;

/**
 * Định dạng số kiểu Việt — format, không phải nhãn UI:
 *   `${x} đ`, `${x} đồng`, `${x} tỷ`, `${x} triệu`, `toLocaleString('vi-VN')`
 * Đơn vị quốc tế (tỷ/triệu) là cách viết riêng của tiếng Việt; dịch sang
 * EN cần đổi cả hệ đơn vị (K/M/B) nên thuộc ticket riêng, không gộp vào
 * việc đưa nhãn UI qua `t()`.
 */
const VI_UNITS_RE = /(\btỷ\b|\btriệu\b|đồng|'vi-VN'|"vi-VN")/;
const EXTS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '__tests__', '__mocks__', 'coverage']);

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error('usage: node scripts/check-i18n-hardcoded.mjs <dir-or-file...>');
  process.exit(2);
}

function walk(target, out) {
  let stats;
  try {
    stats = statSync(target);
  } catch {
    console.error(`khong tim thay: ${target}`);
    process.exit(2);
  }
  if (stats.isFile()) {
    if (EXTS.has(extname(target))) out.push(target);
    return;
  }
  for (const entry of readdirSync(target)) {
    if (SKIP_DIRS.has(entry)) continue;
    walk(join(target, entry), out);
  }
}

/**
 * Phân loại một dòng.
 *
 * @param {string} rawLine nội dung dòng
 * @param {boolean} inBlockComment `true` nếu dòng này nằm trong một block
 *   comment bắt đầu từ dòng trước (JSDoc, hoặc comment JSX nhiều dòng).
 *   Xử lý từng dòng độc lập sẽ báo nhầm nội dung comment là nhãn cần dịch —
 *   đã gặp thật với comment 3 dòng trong `WhaleAdvisoryCommandPanel.jsx`.
 * @returns {{hardcoded: boolean, reason: string}} `hardcoded=true` nghĩa là
 *   dòng chứa tiếng Việt KHÔNG đi qua i18n → phải báo lỗi.
 */
function classifyLine(rawLine, inBlockComment) {
  const skip = (reason) => ({ hardcoded: false, reason });
  const bad = (reason) => ({ hardcoded: true, reason });

  if (inBlockComment) return skip('comment');
  if (/^\s*(\*|\/\*)/.test(rawLine)) return skip('comment');

  // Bỏ comment một dòng trước khi phân tích phần còn lại.
  const line = rawLine
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/(^|[^:])\/\/.*$/, '$1');

  if (/\bt\s*\(/.test(line)) return skip('uses t()');
  if (/defaultValue/.test(line)) return skip('defaultValue');
  if (/defaultLabel|defaultDescription/.test(line)) return skip('defaultLabel');
  if (/className|class=/.test(line)) return skip('className');
  if (/\.(test|spec)\./.test(line)) return skip('test file');

  // Định dạng số kiểu Việt (`${x} đ`, `${x} tỷ`, `${x} triệu`, `vi-VN`) là
  // format, KHÔNG phải nhãn UI — dịch nó không có nghĩa. Bỏ qua có chủ đích;
  // chuyển sang đơn vị đa ngôn ngữ là việc riêng, ghi ở backlog.
  if (VI_UNITS_RE.test(line)) return skip('vietnamese number unit');

  // Phần còn lại của template literal nhiều dòng. Ví dụ dòng ``})} đ`;`` là đuôi
  // của ``${x.toLocaleString('vi-VN')} đ` `` bắt đầu ở dòng trước. Chuỗi được
  // ghép luôn bắt đầu ở dòng có `${`, nên nếu dòng đã bắt đầu ở dòng khác thì
  // tiếng Việt trong nó chỉ có thể là đơn vị định dạng số — đã được `VI_UNITS_RE`
  // bỏ qua. Ở đây ta bỏ qua để không báo trùng cho cùng một nhãn.
  if (/`[^`]*\$\{|\}[^`]*`/.test(line)) return skip('template continuation');

  // dạng 1: string literal
  const literals = line.match(/'[^']*'|"[^"]*"|`[^`]*`/g) || [];
  if (literals.some((literal) => VI_REGEX.test(literal))) {
    return bad('string literal');
  }

  // dạng 2: JSX text node — nội dung nằm giữa `>` và `<`, không phải literal.
  // Bỏ qua mọi thứ nằm trong `{...}` vì đó là biểu thức JS, không phải text.
  const textNode = line.replace(/<[^>]*>/g, ' ').replace(/\{[^}]*\}/g, ' ');
  if (VI_REGEX.test(textNode)) return bad('jsx text node');

  return skip('no vietnamese');
}

/** Cập nhật trạng thái "đang trong block comment" sau khi đọc `line`. */
function nextBlockCommentState(state, line) {
  const opens = (line.match(/\/\*/g) || []).length;
  const closes = (line.match(/\*\//g) || []).length;
  return state || opens > closes;
}

const files = [];
for (const target of targets) walk(target, files);

let total = 0;
const report = [];
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const hits = [];
  let inComment = false;
  lines.forEach((line, index) => {
    const verdict = classifyLine(line, inComment);
    inComment = nextBlockCommentState(inComment, line);
    if (!VI_REGEX.test(line)) return;
    if (!verdict.hardcoded) return;
    hits.push({ line: index + 1, reason: verdict.reason, text: line.trim().slice(0, 120) });
  });
  if (hits.length === 0) continue;
  total += hits.length;
  report.push(`\n${relative(process.cwd(), file)} (${hits.length})`);
  for (const hit of hits) {
    report.push(`  ${hit.line} [${hit.reason}]: ${hit.text}`);
  }
}

if (total === 0) {
  console.log(`OK: 0 chuoi tieng Viet hardcode trong ${files.length} file (${targets.join(', ')})`);
  process.exit(0);
}

console.log(report.join('\n'));
console.log(`\nTOTAL_HARDCODED_VI=${total}`);
process.exit(1);
