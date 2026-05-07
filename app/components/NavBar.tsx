'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Species Explorer', href: '/species' },
  { label: 'Map', href: '/map' },
  { label: 'Schools & Visitors', href: '/schools-visitors' },
  { label: 'About', href: '/about' },
];

export default function NavBar() {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        backgroundColor: '#ffffff',
        transform: visible ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 2px 16px rgba(12,96,56,0.12)',
        borderBottom: '1px solid rgba(12,96,56,0.08)',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 2rem',
          height: '86px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Logo + Brand name */}
        <Link
          href="/"
          style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', textDecoration: 'none' }}
        >
          <Image
            src="/images/nep-logo.png"
            alt="Nyandungu Eco-Park"
            width={70}
            height={70}
            style={{ objectFit: 'contain' }}
            priority
          />
          <span
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 600,
              fontSize: '16px',
              color: 'var(--meadow-green)',
              lineHeight: 1.25,
              maxWidth: '220px',
            }}
          >
            Biodiversity and Research Department
          </span>
        </Link>

        {/* Nav links */}
        <ul
          style={{
            display: 'flex',
            gap: '0.15rem',
            listStyle: 'none',
            margin: 0,
            padding: 0,
            alignItems: 'center',
          }}
        >
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                style={{
                  display: 'block',
                  padding: '0.45rem 0.9rem',
                  borderRadius: '6px',
                  color: 'var(--outerspace)',
                  textDecoration: 'none',
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 500,
                  fontSize: '0.88rem',
                  letterSpacing: '0.01em',
                  transition: 'background 0.2s, color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--meadow-green)';
                  e.currentTarget.style.background = 'rgba(12,96,56,0.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--outerspace)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
