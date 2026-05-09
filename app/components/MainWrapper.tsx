'use client';

import { usePathname } from 'next/navigation';

export default function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMap = pathname === '/map';

  return (
    <main style={{
      paddingTop: isMap ? 0 : '68px',
      height: isMap ? 'calc(100vh - 68px)' : undefined,
      minHeight: isMap ? undefined : '100vh',
      overflow: isMap ? 'hidden' : undefined,
      background: isMap
        ? 'transparent'
        : 'linear-gradient(135deg, #e8f5e9 0%, #F7F5EF 30%, #f0f7f0 60%, #e8f2eb 100%)',
    }}>
      {children}
    </main>
  );
}
