'use client';

import { usePathname } from 'next/navigation';

export default function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMap = pathname === '/map';

  return (
    <main className={isMap ? 'main-content main-content--flush' : 'main-content'}>
      {children}
    </main>
  );
}
