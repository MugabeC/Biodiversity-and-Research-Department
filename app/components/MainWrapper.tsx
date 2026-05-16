'use client';

import { usePathname } from 'next/navigation';

export default function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMap = pathname === '/map';

  return (
    <main style={{
      paddingTop: isMap ? 0 : '68px',
      minHeight: '100vh',
      background: 'transparent',
    }}>
      {children}
    </main>
  );
}
