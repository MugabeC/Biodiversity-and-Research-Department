'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import SpeciesPhoto from '../components/SpeciesPhoto';
import { loadSpeciesImageCache, getCachedSpeciesImage } from '../lib/speciesImageCache';

// ── Types ─────────────────────────────────────────────────────────────────────

type Species = {
  uid: string;
  taxa: string;
  commonName: string;
  scientificName: string;
  family: string;
  iucn: string;
  endemism: string;
  imageUrl: string | null;
};

/** Loose species row shape from merged species.json (all taxa). */
type SpeciesJsonRow = {
  taxa: string;
  id: number;
  commonName?: string;
  genusSpecies?: string;
  scientificName?: string;
  family?: string;
  status?: string;
  iucn?: string;
  iucnGlobal?: string;
  endemism?: string;
  albertineRiftEndemic?: string;
  origin?: string;
};

// ── Endemism normalization ────────────────────────────────────────────────────

function getEndemism(s: SpeciesJsonRow): string {
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

function normalize(s: SpeciesJsonRow): Species {
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
    imageUrl: null,
  };
}

function withImageUrl(s: Species, cache: Awaited<ReturnType<typeof loadSpeciesImageCache>>): Species {
  const entry = getCachedSpeciesImage(cache, s.uid);
  if (entry === undefined) return s;
  return { ...s, imageUrl: entry?.url ?? null };
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
    <span className="heading" style={{
      fontSize: '12px',
      color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em',
      alignSelf: 'center', whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

// ── Species card ──────────────────────────────────────────────────────────────

function SpeciesCard({ species }: { species: Species }) {
  const iucnStyle = IUCN_STYLE[species.iucn] ?? IUCN_STYLE.NE;
  const displayName = species.commonName || species.scientificName;

  return (
    <Link href={`/species/${species.uid}`} className="species-card">
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <SpeciesPhoto
          uid={species.uid}
          scientificName={species.scientificName}
          commonName={species.commonName}
          taxa={species.taxa}
          alt={displayName || species.taxa}
          imageUrl={species.imageUrl}
          height={160}
        />
        <span style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: iucnStyle.bg,
          color: iucnStyle.color,
          borderRadius: '9999px',
          padding: '3px 9px',
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
        <p className="heading" style={{
          fontSize: '15px',
          color: 'var(--text-primary)', margin: '0 0 2px',
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
    Promise.all([
      fetch('/data/species/species.json').then(r => r.json()),
      loadSpeciesImageCache(),
    ])
      .then(([data, imageCache]) => {
        const normalized = (data.species as SpeciesJsonRow[])
          .map(normalize)
          .map(s => withImageUrl(s, imageCache));
        setAllSpecies(normalized);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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
          <h1 className="heading" style={{
            fontSize: '32px', color: 'var(--accent-text)', margin: 0, lineHeight: 1.2,
          }}>
            Species Explorer
          </h1>
          <p style={{
            fontSize: '15px', color: 'var(--text-secondary)', margin: '6px 0 0',
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
