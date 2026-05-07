import type { ReactNode } from 'react';
import { Footer } from './Footer';
import { TopNav } from './TopNav';

export function SiteFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
