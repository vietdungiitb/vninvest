import { createElement } from 'react';
import { DeepLevel2 } from './DeepLevel2.js';

const e = createElement;

export function DeepLevel1() {
  return e('section', null, e(DeepLevel2, null));
}
