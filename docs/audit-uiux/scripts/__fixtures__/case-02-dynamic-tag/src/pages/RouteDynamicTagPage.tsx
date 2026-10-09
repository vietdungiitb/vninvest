import { createElement } from 'react';

const e = createElement;

// level là prop ⇒ KHÔNG có cách nào biết tĩnh tag này là 'h1' hay không.
export function RouteDynamicTagPage({ level }) {
  const tag = level === 1 ? 'h1' : 'h2';
  return e('section', null, e(tag, { className: 'dyn-title' }, 'Tiêu đề sinh động'));
}
