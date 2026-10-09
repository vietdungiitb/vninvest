import { createElement } from 'react';

export function RouteNoH1Page() {
  return createElement('section', { className: 'page' }, createElement('h2', null, 'Chỉ có h2'));
}
