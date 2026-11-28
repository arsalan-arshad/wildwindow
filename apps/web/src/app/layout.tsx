import type { Metadata } from 'next';
import { Fraunces, Source_Sans_3 } from 'next/font/google';

import { ObservabilityProvider } from '@/components/observability-provider';
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

const ogImage = {
  url: '/og/og-1200x630.png',
  width: 1200,
  height: 630,
  alt: 'WildWindow — wildlife photo forecasts without pinning sensitive species',
} as const;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'WildWindow',
    template: '%s · WildWindow',
  },
  description:
    'Wildlife photo forecasts for Scotland and Sindh — a weekly Window score without pinning sensitive species.',
  // app/favicon.ico + app/icon.png are the App Router sources of truth (do not also
  // ship public/favicon.ico — Next 500s on the conflict). Extra PNG sizes stay in public/.
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'WildWindow',
    description:
      'When to photograph wildlife this week — without pinning it. Beta: Scotland and Sindh.',
    url: siteUrl,
    siteName: 'WildWindow',
    locale: 'en_GB',
    type: 'website',
    images: [ogImage],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WildWindow',
    description:
      'When to photograph wildlife this week — without pinning it. Beta: Scotland and Sindh.',
    images: [ogImage.url],
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
        <ObservabilityProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
        </ObservabilityProvider>
      </body>
    </html>
  );
}
