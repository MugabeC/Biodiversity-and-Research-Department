import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';
import AppShell from './components/AppShell';

const SITE_URL = 'https://biodiversity-and-research-departmen-roan.vercel.app';
const DESCRIPTION =
  'Nyandungu Eco-Park biodiversity dashboard: species checklist, park map, monitoring figures and documents from the Biodiversity and Research Department.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Biodiversity and Research Department | Nyandungu Eco-Park',
    template: '%s | Nyandungu Eco-Park',
  },
  description: DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: 'Nyandungu Eco-Park',
    title: 'Biodiversity and Research Department',
    description: DESCRIPTION,
    url: SITE_URL,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Nyandungu Eco-Park, Biodiversity and Research Department' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Biodiversity and Research Department',
    description: DESCRIPTION,
    images: ['/og.png'],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.setAttribute('data-theme','light');`,
          }}
        />
      </head>
      <body>
        <AppShell>{children}</AppShell>
        <Analytics />
      </body>
    </html>
  );
}
