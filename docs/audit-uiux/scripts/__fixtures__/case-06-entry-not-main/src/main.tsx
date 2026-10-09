import { createElement } from 'react';

// main.tsx KHÔNG được index.html trỏ tới và không ai import nó.
export function main() {
  return createElement('h1', null, 'h1 trong file không ai nạp');
}
