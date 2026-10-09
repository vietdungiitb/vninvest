import { createElement } from 'react';
import { DeepLevel1 } from '../components/DeepLevel1.jsx';

export function RouteDeepPage() {
  return createElement('main', null, createElement(DeepLevel1, null));
}
