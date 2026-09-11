import { createElement } from 'react';
import { useLocation } from 'react-router-dom';

const PT_CSS = `
@keyframes ptFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes ptFadeInStagger {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
.ptFadeIn {
  animation: ptFadeIn 0.25s ease-out;
}
.ptStagger > * {
  animation: ptFadeInStagger 0.3s ease-out both;
}
.ptStagger > *:nth-child(1) { animation-delay: 0.02s; }
.ptStagger > *:nth-child(2) { animation-delay: 0.06s; }
.ptStagger > *:nth-child(3) { animation-delay: 0.10s; }
.ptStagger > *:nth-child(4) { animation-delay: 0.14s; }
.ptStagger > *:nth-child(5) { animation-delay: 0.18s; }
.ptStagger > *:nth-child(6) { animation-delay: 0.22s; }
.ptStagger > *:nth-child(7) { animation-delay: 0.26s; }
.ptStagger > *:nth-child(8) { animation-delay: 0.30s; }
`;

export function PageTransition({ children, stagger }: { children: React.ReactNode; stagger?: boolean }) {
  const location = useLocation();

  return createElement(
    'div',
    { key: location.key, className: stagger ? 'ptStagger' : 'ptFadeIn' },
    createElement('style', null, PT_CSS),
    children,
  );
}
