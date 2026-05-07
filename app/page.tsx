import fs from 'fs';
import path from 'path';
import BiodiversityCharts from './components/BiodiversityCharts';

// ─── Static taxa card config ──────────────────────────────────────────────────

const TAXA_CARDS = [
  { taxa: 'Birds', count: 251, icon: '🐦', count2023: 83 },
  { taxa: 'Plants', count: 468, icon: '🌿', count2023: 260 },
  { taxa: 'Butterflies', count: 57, icon: '🦋', count2023: 56 },
  { taxa: 'Aquatic Inverts', count: 52, icon: '🦐', count2023: 29 },
  { taxa: 'Amphibians & Reptiles', count: 22, icon: '🐸', count2023: 12 },
  { taxa: 'Mammals', count: 13, icon: '🦦', count2023: 9 },
  { taxa: 'Fish', count: 7, icon: '🐟', count2023: 7 },
];

// ─── IUCN computation (runs server-side) ─────────────────────────────────────

const IUCN_SOURCES = [
  { file: 'birds.json', field: 'status', split: true },
  { file: 'plants.json', field: 'iucnGlobal', split: false },
  { file: 'amphibians-reptiles.json', field: 'iucnGlobal', split: false },
  { file: 'fish.json', field: 'iucn', split: false },
  { file: 'butterflies.json', field: 'iucn', split: false },
  { file: 'mammals.json', field: 'iucn', split: false },
] as const;

const KNOWN = new Set(['LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'EX', 'DD', 'NE']);

function computeIUCNStats() {
  const counts: Record<string, number> = {};
  const dir = path.join(process.cwd(), 'public', 'data', 'species');

  for (const { file, field, split } of IUCN_SOURCES) {
    const { species } = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
    for (const sp of species) {
      let raw = (sp[field as string] ?? '').trim();
      if (split) raw = raw.split(',')[0].trim();
      // Normalise to 2-letter uppercase code
      const code = raw.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 2);
      const key = KNOWN.has(code) ? code : 'DD';
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  return Object.entries(counts)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const iucnData = computeIUCNStats();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', paddingBottom: '5rem' }}>

      {/* ── Hero ── */}
      <section
        style={{
          background: 'var(--meadow-green)',
          padding: '3.5rem 2rem 3rem',
          textAlign: 'center',
        }}
      >
        <h1
          className="font-comforter"
          style={{
            fontSize: 'clamp(2.2rem, 5vw, 4rem)',
            color: 'var(--golden)',
            lineHeight: 1.15,
            marginBottom: '0.6rem',
          }}
        >
          Biodiversity and Research Department
        </h1>
        <p
          style={{
            color: 'var(--peach)',
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 400,
            fontSize: '0.95rem',
            letterSpacing: '0.18em',
            opacity: 0.85,
          }}
        >
          NYANDUNGU ECO-PARK · 2025 SPECIES REPORT
        </p>
      </section>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>

        {/* ── Taxa summary cards ── */}
        <section style={{ marginBottom: '3rem' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
              gap: '1rem',
            }}
          >
            {TAXA_CARDS.map((card) => {
              const delta = card.count - card.count2023;
              const pct = card.count2023 > 0
                ? Math.round((delta / card.count2023) * 100)
                : 0;
              return (
                <div
                  key={card.taxa}
                  style={{
                    background: '#ffffff',
                    borderRadius: '14px',
                    padding: '1.5rem 1rem 1.25rem',
                    boxShadow: '0 2px 14px rgba(12,96,56,0.08)',
                    borderTop: '4px solid var(--meadow-green)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.35rem',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: '2.1rem', lineHeight: 1 }}>{card.icon}</span>
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      color: 'var(--outerspace)',
                      letterSpacing: '0.02em',
                      lineHeight: 1.3,
                    }}
                  >
                    {card.taxa}
                  </span>
                  <span
                    style={{
                      fontSize: '2.4rem',
                      fontWeight: 700,
                      color: 'var(--meadow-green)',
                      lineHeight: 1,
                    }}
                  >
                    {card.count}
                  </span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 500,
                      color: pct > 0 ? '#0C6038' : pct < 0 ? '#c0392b' : '#888',
                    }}
                  >
                    {pct > 0 ? `▲ +${pct}% since 2023` : pct < 0 ? `▼ ${pct}% since 2023` : 'stable since 2023'}
                  </span>
                </div>
              );
            })}

            {/* Total card */}
            <div
              style={{
                background: 'var(--meadow-green)',
                borderRadius: '14px',
                padding: '1.5rem 1rem 1.25rem',
                boxShadow: '0 2px 14px rgba(12,96,56,0.2)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.35rem',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: '2.1rem', lineHeight: 1 }}>🌍</span>
              <span
                style={{
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  color: 'var(--peach)',
                  letterSpacing: '0.02em',
                }}
              >
                Total Species
              </span>
              <span
                style={{
                  fontSize: '2.4rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  lineHeight: 1,
                }}
              >
                870
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--golden)' }}>
                across 7 taxa groups
              </span>
            </div>
          </div>
        </section>

        {/* ── Charts ── */}
        <BiodiversityCharts iucnData={iucnData} />
      </div>
    </div>
  );
}
