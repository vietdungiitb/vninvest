import { createElement } from 'react';
// File này KHÔNG tồn tại trên đĩa.
import { MissingWidget } from './MissingWidget.tsx';

export function RouteBrokenImportPage() {
  return createElement('section', null, createElement(MissingWidget, { label: 'x' }));
}
