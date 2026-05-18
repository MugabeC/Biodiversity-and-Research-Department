'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SpeciesPhoto from '../../components/SpeciesPhoto';
import { buildSpeciesWhatsAppMessage, copySpeciesMessage, shareViaWhatsApp } from '../../lib/shareWhatsApp';

// ── Types ─────────────────────────────────────────────────────────────────────

type RawSpecies = {
  taxa: string;
  id: number;
  commonName?: string;
  genusSpecies?: string;
  scientificName?: string;
  status?: string;
  iucn?: string;
  iucnGlobal?: string;
  endemism?: string;
  albertineRiftEndemic?: string;
  origin?: string;
  feedingGroup?: string;
  pollutionTolerance?: string;
  order?: string;
  family?: string;
  class?: string;
  group?: string;
  kinyarwanda?: string;
  description_short?: string;
  habitat_types?: string[];
  ecological_role?: string[];
};

// ── Lookup tables ─────────────────────────────────────────────────────────────

const TAXA_LABELS: Record<string, string> = {
  birds:                 'Birds',
  plants:                'Plants',
  butterflies:           'Butterflies',
  aquatic_inverts:       'Aquatic Inverts',
  'amphibians-reptiles': 'Amphibians & Reptiles',
  mammals:               'Mammals',
  fish:                  'Fish',
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function getIucn(s: RawSpecies): string {
  if (s.taxa === 'birds' && s.status) return s.status.split(',')[0];
  if (s.iucn) return s.iucn;
  if (s.iucnGlobal) return s.iucnGlobal;
  return 'NE';
}

function getEndemism(s: RawSpecies): { headline: string; sub: string } {
  if (s.taxa === 'birds') {
    const code = s.status?.split(',')[1];
    if (code === 'R') return { headline: 'Native', sub: 'Resident species' };
    if (code === 'I') return { headline: 'Migratory', sub: 'Intra-African Migrant' };
    if (code === 'P') return { headline: 'Migratory', sub: 'Palearctic Migrant' };
    return { headline: '—', sub: '' };
  }
  if (s.taxa === 'mammals' || s.taxa === 'amphibians-reptiles') {
    if (s.endemism === 'Albertine Rift Endemic') return { headline: 'Endemic', sub: 'Albertine Rift Endemic' };
    if (s.endemism === 'Not Endemic') return { headline: 'Native', sub: 'Not Endemic' };
    if (s.endemism === 'Widespread') return { headline: 'Native', sub: 'Widespread species' };
    return { headline: s.endemism || '—', sub: '' };
  }
  if (s.taxa === 'plants') {
    if (s.albertineRiftEndemic === 'AR') return { headline: 'Endemic', sub: 'Albertine Rift Endemic' };
    if (s.albertineRiftEndemic === 'No') return { headline: 'Native', sub: 'Not endemic' };
    return { headline: s.albertineRiftEndemic || '—', sub: '' };
  }
  if (s.taxa === 'fish') {
    if (typeof s.origin === 'string') {
      if (s.origin.startsWith('Native')) return { headline: 'Native', sub: s.origin };
      if (s.origin.startsWith('Introduced')) return { headline: 'Introduced', sub: s.origin };
    }
    return { headline: '—', sub: '' };
  }
  return { headline: '—', sub: 'No data available' };
}

// Extra taxa-specific key-value pairs to display as pills in the hero
function getExtraPills(s: RawSpecies): { label: string; value: string }[] {
  const pills: { label: string; value: string }[] = [];
  if (s.taxa === 'birds' && s.status) {
    const code = s.status.split(',')[1];
    const map: Record<string, string> = { R: 'Resident', I: 'Intra-African Migrant', P: 'Palearctic Migrant' };
    if (map[code]) pills.push({ label: 'Residency', value: map[code] });
  }
  if (s.feedingGroup)       pills.push({ label: 'Feeding Group',        value: s.feedingGroup });
  if (s.pollutionTolerance) pills.push({ label: 'Pollution Tolerance',  value: s.pollutionTolerance });
  if (s.origin)             pills.push({ label: 'Origin',               value: s.origin });
  return pills;
}

// ── Shared styles ─────────────────────────────────────────────────────────────

// ── Small components (defined before use) ─────────────────────────────────────

function BackButton() {
  return (
    <Link href="/species" className="species-back-link">
      ← Back to Species Explorer
    </Link>
  );
}

function Pill({ children, variant = 'green' }: { children: React.ReactNode; variant?: 'green' | 'gray' }) {
  return (
    <span className={variant === 'green' ? 'species-pill' : 'species-pill species-pill--gray'}>
      {children}
    </span>
  );
}

function ExternalLinkBtn({ href, label, bg, textColor = '#ffffff' }: {
  href: string; label: string; bg: string; textColor?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-block',
        padding: '10px 20px',
        borderRadius: '9999px',
        background: bg,
        color: textColor,
        fontFamily: 'Poppins, sans-serif',
        fontWeight: 500,
        fontSize: '14px',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {label} ↗
    </a>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SpeciesDetailPage({ params }: { params: { id: string } }) {
  const uid = params.id;
  const [species, setSpecies]       = useState<RawSpecies | null>(null);
  const [notFound, setNotFound]     = useState(false);
  const [loading, setLoading]       = useState(true);
  const [description, setDescription] = useState('');
  const [descriptionLoading, setDescriptionLoading] = useState(false);
  useEffect(() => {
    // uid format: "{taxa}-{numericId}" — taxa can contain hyphens (amphibians-reptiles)
    // so split on the LAST hyphen
    const lastDash = uid.lastIndexOf('-');
    const taxa     = uid.slice(0, lastDash);
    const numId    = parseInt(uid.slice(lastDash + 1), 10);

    fetch('/data/species/species.json')
      .then(r => r.json())
      .then(data => {
        const found = (data.species as RawSpecies[]).find(
          s => s.taxa === taxa && s.id === numId
        );
        if (found) setSpecies(found);
        else setNotFound(true);
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [uid]);

  useEffect(() => {
    if (!species) return;

    const initial = species.description_short?.trim() || '';
    setDescription(initial);
    if (initial) {
      setDescriptionLoading(false);
      return;
    }

    const scientific = species.scientificName || species.genusSpecies || '';
    if (!scientific.trim()) {
      setDescriptionLoading(false);
      return;
    }

    let cancelled = false;
    setDescriptionLoading(true);

    const params = new URLSearchParams({ scientific });
    const common = species.commonName?.trim();
    if (common) params.set('common', common);

    fetch(`/api/species-description?${params}`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled && data?.description) setDescription(data.description);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDescriptionLoading(false);
      });

    return () => { cancelled = true; };
  }, [species]);

  // ── Loading ──
  if (loading) {
    return (
      <div style={{
        minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Poppins, sans-serif', fontSize: '15px', color: 'var(--text-secondary)',
      }}>
        Loading…
      </div>
    );
  }

  // ── Not found ──
  if (notFound || !species) {
    return (
      <div style={{ maxWidth: '640px', margin: '4rem auto', textAlign: 'center', padding: '0 1.5rem' }}>
        <BackButton />
        <p style={{ fontFamily: 'Poppins, sans-serif', fontSize: '20px', color: 'var(--text-secondary)', marginTop: '2rem' }}>
          Species not found.
        </p>
      </div>
    );
  }

  // ── Derived values ──
  const iucn        = getIucn(species);
  const iucnStyle   = IUCN_STYLE[iucn] ?? IUCN_STYLE.NE;
  const endemism    = getEndemism(species);
  const extraPills  = getExtraPills(species);
  const commonName     = species.commonName || species.genusSpecies || species.scientificName || '—';
  const scientificName = species.scientificName || species.genusSpecies || '';
  const kinyarwanda    = species.kinyarwanda || '';
  const habitatTypes   = Array.isArray(species.habitat_types)    ? species.habitat_types    : [];
  const ecologicalRole = Array.isArray(species.ecological_role)  ? species.ecological_role  : [];

  // Feeding group as fallback ecological role
  const ecoPills: string[] = ecologicalRole.length > 0
    ? ecologicalRole
    : species.feedingGroup ? [species.feedingGroup] : [];

  const sciNamePlus  = scientificName.replace(/ /g, '+');
  const sciNameUnderscore = scientificName.replace(/ /g, '_');

  const waMessage = buildSpeciesWhatsAppMessage({
    commonName,
    scientificName,
    kinyarwanda,
    taxaLabel: TAXA_LABELS[species.taxa] ?? species.taxa,
    order: species.order || '—',
    family: species.family || '—',
    iucn,
    endemismHeadline: endemism.headline,
    endemismSub: endemism.sub,
    habitat: habitatTypes.length > 0 ? habitatTypes.join(', ') : 'Data not yet available',
    ecologicalRole: ecoPills.length > 0 ? ecoPills.join(', ') : 'Data not yet available',
    description: description || 'No description available yet',
  });

  function handleWhatsAppShare() {
    void shareViaWhatsApp(waMessage);
  }

  function handleCopyMessage() {
    void copySpeciesMessage(waMessage);
  }

  return (
    <div style={{ paddingBottom: '5rem' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.5rem 0' }}>

        {/* ── Back button ── */}
        <BackButton />

        {/* ── Hero ── */}
        <div className="species-hero" style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>

          <div className="species-hero-image">
            <div style={{ position: 'relative', borderRadius: '20px', overflow: 'hidden', maxHeight: '500px' }}>
              <SpeciesPhoto
                uid={uid}
                scientificName={scientificName}
                commonName={commonName}
                taxa={species.taxa}
                alt={commonName}
                height={360}
                priority
              />
            </div>
          </div>

          {/* Details */}
          <div className="species-hero-content">

            {/* IUCN badge */}
            <span style={{
              display: 'inline-block',
              background: iucnStyle.bg,
              color: iucnStyle.color,
              borderRadius: '9999px',
              padding: '6px 20px',
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 700,
              fontSize: '16px',
              marginBottom: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}>
              {iucn}
            </span>

            {/* Common name */}
            <h1 className="species-hero-name">{commonName}</h1>

            {/* Scientific name */}
            {scientificName && scientificName !== commonName && (
              <p className="species-hero-sci">{scientificName}</p>
            )}

            {/* Kinyarwanda */}
            {kinyarwanda && (
              <p className="species-hero-kinyarwanda">
                <span className="text-secondary" style={{ fontWeight: 400 }}>Kinyarwanda: </span>
                {kinyarwanda}
              </p>
            )}

            {/* Taxa chip */}
            <div style={{ marginBottom: '18px' }}>
              <Pill>{TAXA_LABELS[species.taxa] ?? species.taxa}</Pill>
            </div>

            {/* Order, Family, Class, Group */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '18px' }}>
              {species.order  && <InfoRow label="Order"  value={species.order} />}
              {species.family && <InfoRow label="Family" value={species.family} />}
              {species.class  && <InfoRow label="Class"  value={species.class} />}
              {species.group  && <InfoRow label="Group"  value={species.group} />}
            </div>

            {/* Taxa-specific extra pills */}
            {extraPills.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {extraPills.map(p => (
                  <Pill key={p.label} variant="gray">{p.label}: {p.value}</Pill>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Details grid ── */}
        <div className="species-detail-grid" style={{ marginBottom: '1.5rem' }}>

          {/* Habitat */}
          <div className="species-detail-card">
            <p className="species-card-label">Habitat Types</p>
            {habitatTypes.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {habitatTypes.map((h: string) => <Pill key={h}>{h}</Pill>)}
              </div>
            ) : (
              <p className="species-body-text species-body-text--muted" style={{ fontSize: '14px', lineHeight: 1.6 }}>
                Habitat data not yet available for this species.
              </p>
            )}
          </div>

          {/* Ecological Role */}
          <div className="species-detail-card">
            <p className="species-card-label">Ecological Role</p>
            {ecoPills.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {ecoPills.map((r: string) => <Pill key={r}>{r}</Pill>)}
              </div>
            ) : (
              <p className="species-body-text species-body-text--muted" style={{ fontSize: '14px', lineHeight: 1.6 }}>
                Ecological role data not yet available.
              </p>
            )}
          </div>

          {/* Endemism */}
          <div className="species-detail-card">
            <p className="species-card-label">Endemism Status</p>
            {endemism.headline && endemism.headline !== '—' ? (
              <div>
                <p className="species-endemism-headline">{endemism.headline}</p>
                {endemism.sub && (
                  <p className="species-body-text" style={{ fontSize: '13px' }}>{endemism.sub}</p>
                )}
              </div>
            ) : (
              <p className="species-body-text species-body-text--muted" style={{ fontSize: '14px' }}>
                Endemism data not available.
              </p>
            )}
          </div>
        </div>

        {/* ── Description ── */}
        <div className="species-detail-card" style={{ marginBottom: '1.5rem' }}>
          <p className="species-section-title">About this Species</p>
          <p className={`species-body-text${description ? '' : ' species-body-text--muted'}`}>
            {descriptionLoading
              ? 'Loading species information…'
              : description || 'No description available yet.'}
          </p>
        </div>

        {/* ── External links + WhatsApp ── */}
        <div className="species-detail-card">
          <p className="species-section-title" style={{ marginBottom: '16px' }}>Learn More</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>

            {/* All species */}
            {scientificName && (
              <>
                <ExternalLinkBtn
                  href={`https://www.inaturalist.org/search?q=${sciNamePlus}`}
                  label="iNaturalist"
                  bg="#74ac00"
                />
                <ExternalLinkBtn
                  href={`https://www.iucnredlist.org/search?query=${sciNamePlus}`}
                  label="IUCN Red List"
                  bg="#e8551a"
                />
                <ExternalLinkBtn
                  href={`https://en.wikipedia.org/wiki/${sciNameUnderscore}`}
                  label="Wikipedia"
                  bg="#6d6d6d"
                />
              </>
            )}

            {/* Birds only */}
            {species.taxa === 'birds' && scientificName && (
              <ExternalLinkBtn
                href={`https://ebird.org/search?q=${sciNamePlus}`}
                label="eBird"
                bg="#0a6a8c"
              />
            )}

            {/* Plants only */}
            {species.taxa === 'plants' && scientificName && (
              <ExternalLinkBtn
                href={`https://powo.science.kew.org/results?q=${sciNamePlus}`}
                label="POWO"
                bg="#00695c"
              />
            )}

            {/* Fish only */}
            {species.taxa === 'fish' && scientificName && (
              <ExternalLinkBtn
                href={`https://www.fishbase.se/search.php?requirement=scientific+name&search=${sciNamePlus}`}
                label="FishBase"
                bg="#1565c0"
              />
            )}

            {/* WhatsApp — wa.me opens contact picker; no preset phone number */}
            <button
              type="button"
              onClick={() => void handleWhatsAppShare()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 22px',
                borderRadius: '9999px',
                border: 'none',
                cursor: 'pointer',
                background: '#25D366',
                color: '#ffffff',
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 600,
                fontSize: '14px',
                boxShadow: '0 2px 10px rgba(37,211,102,0.35)',
                transition: 'opacity 0.2s ease',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Share on WhatsApp
            </button>
            <button
              type="button"
              onClick={() => void handleCopyMessage()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '9px 16px',
                borderRadius: '9999px',
                border: '1px solid var(--surface-glass-border)',
                background: 'var(--surface-glass)',
                color: 'var(--accent-text)',
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 500,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Copy message
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Inline helpers ─────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="species-info-row">
      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{label}:</span> {value}
    </p>
  );
}
