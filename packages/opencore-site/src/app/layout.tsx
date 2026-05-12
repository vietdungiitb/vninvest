import type { Metadata } from 'next';
import { Space_Grotesk, Manrope } from 'next/font/google';
import './globals.css';

const headlineFont = Space_Grotesk({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-headline'
});

const bodyFont = Manrope({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-body'
});

export const metadata: Metadata = {
  title: 'VNInvest About',
  description: 'Trang giới thiệu hệ sinh thái VNInvest, vnbroker và VNBrokerCharts.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${headlineFont.variable} ${bodyFont.variable} site-shell min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  );
}
