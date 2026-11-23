'use client';

import Link from 'next/link';
import { useSessionUser } from '@/app/lib/useSessionUser';

export default function SiteFooter() {
  const user = useSessionUser();
  return (
    <footer className="site-footer">
      <p className="site-footer-line">
        Designed by <strong>Mugabe Christian</strong>
        {' · '}
        Contribution by Biodiversity and Research Department | QA parks and Wetland Solution | Nyandungu Eco Park
        {user && user.role !== 'user' && (
          <>
            {' · '}
            <Link href="/update" className="site-footer-staff">Staff: update data</Link>
          </>
        )}
      </p>
    </footer>
  );
}
