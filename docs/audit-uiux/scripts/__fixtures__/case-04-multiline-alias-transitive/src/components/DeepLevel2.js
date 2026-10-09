import { createElement } from 'react';

const e = createElement;

export function DeepLevel2() {
  return e(
    'div',
    { className: 'deep' },
    e(
      'h1',
      { className: 'deep-title' },
      'Tiêu đề nhiều dòng qua alias e'
    )
  );
}
