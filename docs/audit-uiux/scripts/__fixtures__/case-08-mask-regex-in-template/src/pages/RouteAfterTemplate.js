// case-08 — regression cho lỗi masker: regex literal chứa dấu nháy bên trong `${ … }`
// làm scanner nuốt hết phần còn lại của file ⇒ mọi `<h1>` phía sau biến mất KHÔNG có
// cảnh báo nào. Fixture này đặt `<h1>` SAU đoạn đó; nếu masker hỏng lại thì h1 = 0.
import { createElement } from 'react';

const e = createElement;

function toCsvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsvRow(cells) {
  return cells.map(toCsvCell).join(",");
}

export function RouteAfterTemplate() {
  return e(
    'section',
    null,
    e('h1', { className: 'after-template' }, 'h1 nằm SAU template + regex'),
    e('p', null, toCsvRow(['a', 'b"c'])),
  );
}