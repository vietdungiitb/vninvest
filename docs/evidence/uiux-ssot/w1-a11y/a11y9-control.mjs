// Control cho rule A11Y-9 sau khi đổi cửa sổ ±6 dòng (không đụng repo).
const hit = (lines, i) => {
  const line = lines[i];
  const m = line.match(/<(input|select|textarea)\b/i);
  if (!m) return false;
  if (/\bid=/.test(line) && !/type=["'](checkbox|radio)["']/.test(line)) return false;
  const win = lines.slice(Math.max(0, i - 6), i + 7).join('\n');
  if (/aria-label|aria-labelledby/.test(line) || /aria-label|aria-labelledby/.test(win)) return false;
  if (/<(Input|Select|Textarea|Checkbox|Switch)\b/.test(line)) return false;
  if (/<label\b/.test(win)) return false;
  if (/htmlFor\s*=/.test(win)) return false;
  return true;
};
const withAriaNextLine = ['<input', '  type="date"', '  aria-label={t("x")}', '/>'];
const noName = ['<input', '  type="text"', '  value={x}', '/>'];
const withLabel = ['<label htmlFor="x">Tên</label>', '<input id="x" />'];
const withFormField = ['<FormField htmlFor="x" label="Tên">', '  <input', '    id="x"', '  />'];
console.log('CONTROL aria-label dòng sau → hit?', hit(withAriaNextLine, 0), '(expect false)');
console.log('CONTROL không có tên → hit?', hit(noName, 0), '(expect true)');
console.log('CONTROL <label> → hit?', hit(withLabel, 1), '(expect false)');
console.log('CONTROL FormField htmlFor → hit?', hit(withFormField, 1), '(expect false)');
if (hit(withAriaNextLine, 0) || !hit(noName, 0) || hit(withLabel, 1) || hit(withFormField, 1)) process.exit(1);
