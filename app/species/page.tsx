'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import SpeciesPhoto from '../components/SpeciesPhoto';
import { loadSpeciesFromBundle, type SpeciesJsonRow } from '../lib/speciesData';
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
  iucn = iucn.trim().toUpperCase();
  if (iucn === '-' || iucn === '—') iucn = 'NE';
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
const IUCN_CHIPS  = ['All', 'LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'NE', 'DD'];
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
      type="button"
      onClick={onClick}
      className={`species-filter-chip${active ? ' species-filter-chip--active' : ''}`}
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
      <div className="species-card-photo">
        <SpeciesPhoto
          uid={species.uid}
          scientificName={species.scientificName}
          commonName={species.commonName}
          taxa={species.taxa}
          alt={displayName || species.taxa}
          imageUrl={species.imageUrl}
          height={160}
        />
        <span
          className="species-card-iucn"
          style={{ background: iucnStyle.bg, color: iucnStyle.color }}
        >
          {species.iucn}
        </span>
      </div>

      <div className="species-card-body">
        <p className="heading species-card-name">{displayName || '—'}</p>
        <p className="species-card-sci">{species.scientificName || '—'}</p>
        <p className="species-card-family">{species.family || '—'}</p>
        <div className="species-card-tags">
          <span className="species-card-tag species-card-tag--taxa">
            {TAXA_LABELS[species.taxa] ?? species.taxa}
          </span>
          {species.endemism && (
            <span className="species-card-tag species-card-tag--muted">
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
    let cancelled = false;
    try {
      const { species } = loadSpeciesFromBundle();
      const normalized = species.map(normalize);
      if (!cancelled) {
        setAllSpecies(normalized);
        setLoading(false);
      }
      loadSpeciesImageCache().then((imageCache) => {
        if (cancelled || !imageCache) return;
        setAllSpecies((prev) => prev.map((s) => withImageUrl(s, imageCache)));
      });
    } catch {
      if (!cancelled) setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const taxaKeySet = taxaFilters.map(t => TAXA_KEY[t]);
    return allSpecies.filter(s => {
      if (taxaFilters.length > 0 && !taxaKeySet.includes(s.taxa)) return false;
      if (iucnFilters.length > 0 && !iucnFilters.includes(s.iucn)) return false;
      if (endemFilters.length > 0 && !endemFilters.includes(s.endemism)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const taxaLabel = (TAXA_LABELS[s.taxa] ?? s.taxa).toLowerCase();
        const redListAliases = [
          s.iucn.toLowerCase(),
          `iucn ${s.iucn.toLowerCase()}`,
          `redlist ${s.iucn.toLowerCase()}`,
          `red list ${s.iucn.toLowerCase()}`,
          `iucn redlist ${s.iucn.toLowerCase()}`,
        ];
        return (
          s.commonName.toLowerCase().includes(q) ||
          s.scientificName.toLowerCase().includes(q) ||
          s.family.toLowerCase().includes(q) ||
          taxaLabel.includes(q) ||
          s.endemism.toLowerCase().includes(q) ||
          redListAliases.some(alias => alias.includes(q))
        );
      }
      return true;
    });
  }, [allSpecies, search, taxaFilters, iucnFilters, endemFilters]);

  const activeFilterCount =
    taxaFilters.length + iucnFilters.length + endemFilters.length;

  return (
    <div style={{ paddingBottom: '5rem' }}>
      <div className="page-shell page-shell--spacious species-explorer-page">

        <div className="species-page-header">
          <h1 className="heading species-page-title">Species Explorer</h1>
          <p className="species-page-subtitle">Nyandungu Eco-Park · 870 Species Recorded</p>
        </div>

        <div className="species-toolbar">
          <div className="species-search-wrap">
            <svg className="species-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              className="species-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or family…"
            />
          </div>
          <div className="species-quick-filters">
            <div className="species-quick-filter-row">
              <FilterLabel>Taxa</FilterLabel>
              <div className="species-filter-chips species-filter-chips--quick">
                {TAXA_CHIPS.map(chip => (
                  <Chip
                    key={chip}
                    label={chip}
                    active={isActive(taxaFilters, chip)}
                    onClick={() => setTaxaFilters(prev => toggleFilter(prev, chip))}
                  />
                ))}
              </div>
            </div>
            <div className="species-quick-filter-row">
              <FilterLabel>IUCN Red List</FilterLabel>
              <div className="species-filter-chips species-filter-chips--quick">
                {IUCN_CHIPS.map(chip => (
                  <Chip
                    key={chip}
                    label={chip}
                    active={isActive(iucnFilters, chip)}
                    onClick={() => setIucnFilters(prev => toggleFilter(prev, chip))}
                  />
                ))}
              </div>
            </div>
          </div>
          <details className="species-filters-details">
            <summary className="species-filters-summary">
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="species-filters-badge">{activeFilterCount}</span>
              )}
            </summary>
            <div className="species-filters-body">
              <div className="species-filter-row species-filter-row--last">
                <FilterLabel>Endemism</FilterLabel>
                <div className="species-filter-chips">
                  {ENDEM_CHIPS.map(chip => (
                    <Chip key={chip} label={chip} active={isActive(endemFilters, chip)}
                      onClick={() => setEndemFilters(prev => toggleFilter(prev, chip))} />
                  ))}
                </div>
              </div>
            </div>
          </details>
        </div>
        <p className="species-results-count">
          {loading ? 'Loading species…' : `Showing ${filtered.length} of 870 species`}
        </p>

        {/* ── Grid ── */}
        {loading ? (
          <div style={{
            textAlign: 'center', padding: '6rem 0',
            fontFamily: 'Poppins, sans-serif', fontSize: '15px', color: 'var(--text-secondary)',
          }}>
            Loading 870 species…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '6rem 0',
            fontFamily: 'Poppins, sans-serif', fontSize: '15px', color: 'var(--text-secondary)',
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
