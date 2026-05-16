'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useTheme } from './ThemeProvider';

const NAV_LINKS = [
  { label: 'Dashboard',        href: '/' },
  { label: 'Species Explorer', href: '/species' },
  { label: 'Map',              href: '/map' },
  { label: 'Documents',        href: '/documents' },
];

export default function NavBar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="site-nav">
      <div className="site-nav-inner">
        <Link href="/" className="site-nav-brand">
          <Image
            src="/images/nep-logo.png"
            alt="Nyandungu Eco-Park"
            width={52}
            height={52}
            style={{ objectFit: 'contain' }}
            unoptimized
            priority
          />
          <span className="site-nav-brand-text">
            Biodiversity and Research Department
          </span>
        </Link>

        <div className="site-nav-actions">
          <ul className="site-nav-links">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`site-nav-link${isActive ? ' site-nav-link--active' : ''}`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            onClick={toggleTheme}
            className="theme-toggle"
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </div>
    </nav>
  );
}
