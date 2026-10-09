import { createElement } from 'react';
import { RouteFromBoot } from './pages/RouteFromBoot.jsx';

export function App() {
  return createElement('div', null, createElement(RouteFromBoot, null));
}
