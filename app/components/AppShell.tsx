'use client';

import { usePathname } from 'next/navigation';
import { ThemeProvider } from './ThemeProvider';
import NavBar from './NavBar';
import MainWrapper from './MainWrapper';
import SiteFooter from './SiteFooter';
import SpeciesImageCacheProvider from './SpeciesImageCacheProvider';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMapPage = pathname === '/map';

  return (
    <ThemeProvider>
      <SpeciesImageCacheProvider>
        <NavBar />
        <MainWrapper>{children}</MainWrapper>
        {!isMapPage && <SiteFooter />}
      </SpeciesImageCacheProvider>
    </ThemeProvider>
  );
}
