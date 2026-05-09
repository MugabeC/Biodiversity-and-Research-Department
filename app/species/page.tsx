'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';

// ── Bird image helper ─────────────────────────────────────────────────────────

const BIRD_BASE = '/images/species/bird images';

function birdPrimaryCandidates(n: number): string[] {
  return [
    `${BIRD_BASE}/birds-${n}.jpg`,
    `${BIRD_BASE}/birds-${n}.JPG`,
    `${BIRD_BASE}/Birds-${n}.jpg`,
    `${BIRD_BASE}/Birds-${n}.JPG`,
  ];
}

// Cycles through candidate srcs on error; hides when all fail.
function BirdPhoto({ num, alt }: { num: number; alt: string }) {
  const candidates = birdPrimaryCandidates(num);
  const [idx, setIdx] = useState(0);
  if (idx >= candidates.length) return null;
  return (
    <img
      src={candidates[idx]}
      alt={alt}
      style={{ position: 'absolute', inset: '8px', width: 'calc(100% - 16px)', height: 'calc(100% - 16px)', objectFit: 'contain' }}
      onError={() => setIdx(i => i + 1)}
    />
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Species = {
  uid: string;
  taxa: string;
  commonName: string;
  scientificName: string;
  family: string;
  iucn: string;
  endemism: string;
};

// ── Endemism normalization ────────────────────────────────────────────────────

function getEndemism(s: any): string {
  if (s.taxa === 'birds') {
    const code = s.status?.split(',')[1];
    if (code === 'R') return 'Native';
    if (code === 'I' || code === 'P') return 'Migratory';
    return '';
  }
  if (s.taxa === 'mammals' || s.taxa === 'amphibians-reptiles') {
    if (s.endemism === 'Albertine Rift Endemic') return 'Endemic';
    if (s.endemism === 'Not Endemic' || s.endemism === 'Widespread') return 'Native';
    return '';
  }
  if (s.taxa === 'plants') {
    if (s.albertineRiftEndemic === 'AR') return 'Endemic';
    if (s.albertineRiftEndemic === 'No') return 'Native';
    return '';
  }
  if (s.taxa === 'fish') {
    if (typeof s.origin === 'string' && s.origin.startsWith('Native')) return 'Native';
    if (typeof s.origin === 'string' && s.origin.startsWith('Introduced')) return 'Introduced';
    return '';
  }
  return ''; // butterflies, aquatic_inverts — no endemism data
}

function normalize(s: any): Species {
  let iucn = 'NE';
  if (s.taxa === 'birds' && s.status) {
    iucn = s.status.split(',')[0];
  } else if (s.iucn) {
    iucn = s.iucn;
  } else if (s.iucnGlobal) {
    iucn = s.iucnGlobal;
  }
  return {
    uid: `${s.taxa}-${s.id}`,
    taxa: s.taxa as string,
    commonName: (s.commonName || s.genusSpecies || '') as string,
    scientificName: (s.scientificName || s.genusSpecies || '') as string,
    family: (s.family || '') as string,
    iucn,
    endemism: getEndemism(s),
  };
}

// ── Static lookup tables ──────────────────────────────────────────────────────

const TAXA_LABELS: Record<string, string> = {
  birds:                 'Birds',
  plants:                'Plants',
  butterflies:           'Butterflies',
  aquatic_inverts:       'Aquatic Inverts',
  'amphibians-reptiles': 'Amphibians & Reptiles',
  mammals:               'Mammals',
  fish:                  'Fish',
};

const TAXA_KEY: Record<string, string> = {
  'Birds':                   'birds',
  'Plants':                  'plants',
  'Butterflies':             'butterflies',
  'Aquatic Inverts':         'aquatic_inverts',
  'Amphibians & Reptiles':   'amphibians-reptiles',
  'Mammals':                 'mammals',
  'Fish':                    'fish',
};

const TAXA_ICONS: Record<string, string> = {
  birds:                 '/images/icons/bird-icon.png',
  plants:                '/images/icons/plant-icon.png',
  butterflies:           '/images/icons/butterfly-icon.png',
  aquatic_inverts:       '/images/icons/aquatic-icon.png',
  'amphibians-reptiles': '/images/icons/amphibian-icon.png',
  mammals:               '/images/icons/mammal-icon.png',
  fish:                  '/images/icons/fish-icon.png',
};

const IUCN_STYLE: Record<string, { bg: string; color: string }> = {
  LC: { bg: '#e8f5e9', color: '#2e7d32' },
  NT: { bg: '#f1f8e9', color: '#558b2f' },
  VU: { bg: '#fff8e1', color: '#e65100' },
  EN: { bg: '#fbe9e7', color: '#bf360c' },
  CR: { bg: '#fce4ec', color: '#880e4f' },
  NE: { bg: '#f5f5f5', color: '#616161' },
  DD: { bg: '#e3f2fd', color: '#0d47a1' },
};

const TAXA_CHIPS  = ['All', 'Birds', 'Plants', 'Butterflies', 'Aquatic Inverts', 'Amphibians & Reptiles', 'Mammals', 'Fish'];
const IUCN_CHIPS  = ['All', 'LC', 'NT', 'VU', 'EN', 'CR', 'NE', 'DD'];
const ENDEM_CHIPS = ['All', 'Endemic', 'Native', 'Introduced', 'Migratory'];

// ── Multi-select helpers (array-based, no Set) ───────────────────────────────
// Empty array means "All" — no filter active.

function toggleFilter(prev: string[], value: string): string[] {
  if (value === 'All') return [];
  if (prev.includes(value)) return prev.filter(v => v !== value);
  return [...prev, value];
}

function isActive(arr: string[], chip: string): boolean {
  return chip === 'All' ? arr.length === 0 : arr.includes(chip);
}

// ── Chip ─────────────────────────────────────────────────────────────────────

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 14px',
        borderRadius: '9999px',
        border: `1.5px solid ${active ? '#0C6038' : '#E0E8E2'}`,
        background: active ? '#0C6038' : 'rgba(255,255,255,0.7)',
        color: active ? '#ffffff' : '#4A5E4F',
        fontFamily: 'Poppins, sans-serif',
        fontWeight: 500,
        fontSize: '13px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
      }}
    >
      {label}
    </button>
  );
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '12px',
      color: '#4A5E4F', textTransform: 'uppercase', letterSpacing: '0.06em',
      alignSelf: 'center', whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

// ── Species card ──────────────────────────────────────────────────────────────

function SpeciesCard({ species }: { species: Species }) {
  const iucnStyle = IUCN_STYLE[species.iucn] ?? IUCN_STYLE.NE;
  const icon = TAXA_ICONS[species.taxa];
  const displayName = species.commonName || species.scientificName;

  // Extract bird number from uid like "birds-45" → 45
  const birdNumMatch = species.uid.match(/^birds-(\d+)$/);
  const birdNum = birdNumMatch ? parseInt(birdNumMatch[1]) : null;

  return (
    <Link
      href={`/species/${species.uid}`}
      className="species-card"
      style={{
        background: 'rgba(255,255,255,0.5)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.6)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(12,96,56,0.10)',
        overflow: 'hidden',
      }}
    >
      {/* Image area: gradient background, contain fit, 8px padding */}
      <div style={{
        position: 'relative',
        height: '160px',
        background: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
      }}>
        {icon && (
          <Image
            src={icon}
            alt={species.taxa}
            width={64}
            height={64}
            style={{ objectFit: 'contain', opacity: 0.55 }}
            unoptimized
          />
        )}
        {/* Real photo overlays placeholder; hides itself if all candidates fail */}
        {birdNum !== null && <BirdPhoto num={birdNum} alt={displayName || species.taxa} />}
        <span style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: iucnStyle.bg,
          color: iucnStyle.color,
          borderRadius: '9999px',
          padding: '3px 9px',
          fontFamily: 'Poppins, sans-serif',
          fontWeight: 600,
          fontSize: '11px',
          lineHeight: 1.6,
          boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
          zIndex: 1,
        }}>
          {species.iucn}
        </span>
      </div>

      {/* Content */}
      <div style={{ padding: '14px 16px 16px' }}>
        <p style={{
          fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '15px',
          color: '#1A2E1F', margin: '0 0 2px',
          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        }}>
          {displayName || '—'}
        </p>
        <p style={{
          fontFamily: 'Poppins, sans-serif', fontWeight: 400, fontStyle: 'italic',
          fontSize: '13px', color: '#4A5E4F', margin: '0 0 4px',
          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        }}>
          {species.scientificName || '—'}
        </p>
        <p style={{
          fontFamily: 'Poppins, sans-serif', fontWeight: 400, fontSize: '12px',
          color: '#808847', margin: '0 0 12px',
        }}>
          {species.family || '—'}
        </p>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{
            background: 'rgba(12,96,56,0.08)', color: '#0C6038', borderRadius: '9999px',
            padding: '3px 10px', fontFamily: 'Poppins, sans-serif', fontWeight: 500, fontSize: '11px',
          }}>
            {TAXA_LABELS[species.taxa] ?? species.taxa}
          </span>
          {species.endemism && (
            <span style={{
              background: 'rgba(74,94,79,0.08)', color: '#4A5E4F', borderRadius: '9999px',
              padding: '3px 10px', fontFamily: 'Poppins, sans-serif', fontWeight: 500, fontSize: '11px',
            }}>
              {species.endemism}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SpeciesExplorerPage() {
  const [allSpecies, setAllSpecies]     = useState<Species[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [taxaFilters, setTaxaFilters]   = useState<string[]>([]);
  const [iucnFilters, setIucnFilters]   = useState<string[]>([]);
  const [endemFilters, setEndemFilters] = useState<string[]>([]);

  useEffect(() => {
    fetch('/data/species/species.json')
      .then(r => r.json())
      .then(data => {
        const normalized = (data.species as any[]).map(normalize);

        // Debug: log the unique endemism values produced by normalization
        const uniqueEndemism = Array.from(
          new Set(normalized.map((s: Species) => s.endemism))
        ).sort();
        console.log('[Species] Unique endemism values:', uniqueEndemism);
        console.log('[Species] Endemism counts:', uniqueEndemism.map(v => ({
          value: v || '(empty)',
          count: normalized.filter((s: Species) => s.endemism === v).length,
        })));

        setAllSpecies(normalized);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const taxaKeySet = taxaFilters.map(t => TAXA_KEY[t]);
    return allSpecies.filter(s => {
      if (taxaFilters.length > 0 && !taxaKeySet.includes(s.taxa)) return false;
      if (iucnFilters.length > 0 && !iucnFilters.includes(s.iucn)) return false;
      if (endemFilters.length > 0 && !endemFilters.includes(s.endemism)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          s.commonName.toLowerCase().includes(q) ||
          s.scientificName.toLowerCase().includes(q) ||
          s.family.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allSpecies, search, taxaFilters, iucnFilters, endemFilters]);

  return (
    <div style={{ paddingBottom: '5rem' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2.5rem 1.5rem 0' }}>

        {/* ── Title ── */}
        <div style={{ marginBottom: '1.75rem' }}>
          <h1 style={{
            fontFamily: 'Poppins, sans-serif', fontWeight: 700,
            fontSize: '32px', color: '#0C6038', margin: 0, lineHeight: 1.2,
          }}>
            Species Explorer
          </h1>
          <p style={{
            fontFamily: 'Poppins, sans-serif', fontWeight: 400,
            fontSize: '15px', color: '#4A5E4F', margin: '6px 0 0',
          }}>
            Nyandungu Eco-Park · 870 Species Recorded
          </p>
        </div>

        {/* ── Search ── */}
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <svg
            style={{
              position: 'absolute', left: 14, top: '50%',
              transform: 'translateY(-50%)', width: 18, height: 18,
              color: '#9E9E9E', pointerEvents: 'none',
            }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            className="species-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by common name, scientific name or family..."
          />
        </div>

        {/* ── Taxa chips ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
          <FilterLabel>Taxa</FilterLabel>
          {TAXA_CHIPS.map(chip => (
            <Chip
              key={chip}
              label={chip}
              active={isActive(taxaFilters, chip)}
              onClick={() => setTaxaFilters(prev => toggleFilter(prev, chip))}
            />
          ))}
        </div>

        {/* ── IUCN chips ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
          <FilterLabel>IUCN</FilterLabel>
          {IUCN_CHIPS.map(chip => (
            <Chip
              key={chip}
              label={chip}
              active={isActive(iucnFilters, chip)}
              onClick={() => setIucnFilters(prev => toggleFilter(prev, chip))}
            />
          ))}
        </div>

        {/* ── Endemism chips ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1rem', alignItems: 'center' }}>
          <FilterLabel>Endemism</FilterLabel>
          {ENDEM_CHIPS.map(chip => (
            <Chip
              key={chip}
              label={chip}
              active={isActive(endemFilters, chip)}
              onClick={() => setEndemFilters(prev => toggleFilter(prev, chip))}
            />
          ))}
        </div>

        {/* ── Live count ── */}
        <p style={{
          fontFamily: 'Poppins, sans-serif', fontWeight: 500,
          fontSize: '14px', color: '#0C6038', margin: '0 0 1.25rem',
        }}>
          {loading ? 'Loading species…' : `Showing ${filtered.length} of 870 species`}
        </p>

        {/* ── Grid ── */}
        {loading ? (
          <div style={{
            textAlign: 'center', padding: '6rem 0',
            fontFamily: 'Poppins, sans-serif', fontSize: '15px', color: '#4A5E4F',
          }}>
            Loading 870 species…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '6rem 0',
            fontFamily: 'Poppins, sans-serif', fontSize: '15px', color: '#4A5E4F',
          }}>
            No species match your filters.
          </div>
        ) : (
          <div className="species-grid">
            {filtered.map(s => (
              <SpeciesCard key={s.uid} species={s} />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
