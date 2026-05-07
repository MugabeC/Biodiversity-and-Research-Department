'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { label: 'Home',              href: '/' },
  { label: 'Species Explorer',  href: '/species' },
  { label: 'Map',               href: '/map' },
  { label: 'Schools & Visitors',href: '/schools-visitors' },
  { label: 'About',             href: '/about' },
];

export default function NavBar() {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const startHideTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), 3000);
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY < 100) {
        setVisible(true);
        startHideTimer();
      }
    };
    startHideTimer();
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor: '#FFFFFF',
        height: '68px',
        borderBottom: '1px solid #E0E8E2',
        transform: visible ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'transform 0.3s ease',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 2rem',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Logo + brand */}
        <Link
          href="/"
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', flexShrink: 0 }}
        >
          <Image
            src="/images/nep-logo.png"
            alt="Nyandungu Eco-Park"
            width={60}
            height={60}
            style={{ objectFit: 'contain' }}
            priority
          />
          <span
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 600,
              fontSize: '15px',
              color: '#0C6038',
              lineHeight: 1.3,
              maxWidth: '200px',
            }}
          >
            Biodiversity and Research Department
          </span>
        </Link>

        {/* Nav links */}
        <ul style={{ display: 'flex', gap: '0.1rem', listStyle: 'none', margin: 0, padding: 0, alignItems: 'center' }}>
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  style={{
                    display: 'block',
                    padding: '6px 14px',
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 500,
                    fontSize: '15px',
                    color: isActive ? '#0C6038' : '#4A5E4F',
                    textDecoration: 'none',
                    borderBottom: isActive ? '2px solid #0C6038' : '2px solid transparent',
                    transition: 'color 0.2s ease, border-color 0.2s ease',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = '#0C6038'; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = '#4A5E4F'; }}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
