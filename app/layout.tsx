import type { Metadata } from 'next';
import './globals.css';
import NavBar from './components/NavBar';
import MainWrapper from './components/MainWrapper';

export const metadata: Metadata = {
  title: 'NEP Biodiversity & Research Department',
  description: 'Nyandungu Eco-Park — 2025 Species Checklist and Biodiversity Research Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        <MainWrapper>{children}</MainWrapper>
      </body>
    </html>
  );
}
