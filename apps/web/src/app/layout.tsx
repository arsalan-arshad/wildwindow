import type { Metadata } from 'next';
import { Fraunces, Source_Sans_3 } from 'next/font/google';

import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

import './globals.css';

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  display: 'swap',
});

const sourceSans = Source_Sans_3({
  variable: '--font-source-sans',
  subsets: ['latin'],
  display: 'swap',
});

const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://wildwindow.arsalandev.studio';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'WildWindow',
    template: '%s · WildWindow',
  },
  description:
    'Wildlife photo forecasts for Scotland and Sindh — a weekly Window score without pinning sensitive species.',
  openGraph: {
    title: 'WildWindow',
    description:
      'When to photograph wildlife this week — without pinning it. Beta: Scotland and Sindh.',
    url: siteUrl,
    siteName: 'WildWindow',
    locale: 'en_GB',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${sourceSans.variable} antialiased`}>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
