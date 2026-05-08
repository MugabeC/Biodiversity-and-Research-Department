import type { Metadata } from 'next';
import './globals.css';
import NavBar from './components/NavBar';

export const metadata: Metadata = {
  title: 'NEP Biodiversity & Research Department',
  description: 'Nyandungu Eco-Park — 2025 Species Checklist and Biodiversity Research Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        <main style={{
          paddingTop: '68px',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #e8f5e9 0%, #F7F5EF 30%, #f0f7f0 60%, #e8f2eb 100%)',
        }}>{children}</main>
      </body>
    </html>
  );
}
