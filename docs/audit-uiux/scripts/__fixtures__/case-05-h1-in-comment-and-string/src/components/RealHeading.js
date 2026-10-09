import { createElement } from 'react';

const e = createElement;

export function RealHeading() {
  return e('h1', { className: 'real' }, 'h1 thật');
}
