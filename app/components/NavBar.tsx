'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from './ThemeProvider';

const NAV_LINKS = [
  { label: 'Dashboard', href: '/' },
  { label: 'Species Explorer', href: '/species' },
  { label: 'Map', href: '/map' },
  { label: 'Documents', href: '/documents' },
];

function NavLinkList({
  id,
  className,
  onNavigate,
}: {
  id?: string;
  className: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <ul id={id} className={className}>
      {NAV_LINKS.map((link) => {
        const isActive = pathname === link.href;
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              className={`site-nav-link${isActive ? ' site-nav-link--active' : ''}`}
              onClick={onNavigate}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function NavBar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle('nav-menu-open', menuOpen);
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.classList.remove('nav-menu-open');
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className={`site-nav${menuOpen ? ' site-nav--menu-open' : ''}`} aria-label="Main">
      <div className="site-nav-bar">
      <div className="site-nav-inner">
        <Link href="/" className="site-nav-brand" onClick={closeMenu}>
          <Image
            src="/images/nep-logo.png"
            alt="Nyandungu Eco-Park"
            width={52}
            height={52}
            style={{ objectFit: 'contain' }}
            unoptimized
            priority
          />
          <span className="site-nav-brand-text">Biodiversity and Research Department</span>
        </Link>

        <NavLinkList className="site-nav-links site-nav-links--bar" onNavigate={closeMenu} />

        <div className="site-nav-actions">
          <button
            type="button"
            className="site-nav-menu-btn"
            aria-expanded={menuOpen}
            aria-controls="site-nav-drawer"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="site-nav-menu-icon" aria-hidden />
            <span className="sr-only">{menuOpen ? 'Close menu' : 'Open menu'}</span>
          </button>

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
      </div>

      {menuOpen && (
        <button
          type="button"
          className="site-nav-backdrop"
          aria-label="Close menu"
          onClick={closeMenu}
        />
      )}

      <NavLinkList
        id="site-nav-drawer"
        className={`site-nav-drawer${menuOpen ? ' site-nav-drawer--open' : ''}`}
        onNavigate={closeMenu}
      />
    </nav>
  );
}
