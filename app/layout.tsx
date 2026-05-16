import type { Metadata } from 'next';
import './globals.css';
import AppShell from './components/AppShell';

export const metadata: Metadata = {
  title: 'NEP Biodiversity & Research Department',
  description: 'Nyandungu Eco-Park — 2025 Species Checklist and Biodiversity Research Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('nep-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
