import Image from 'next/image';
import BiodiversityCharts from './components/BiodiversityCharts';

// ─── Taxa card config ─────────────────────────────────────────────────────────

const TAXA_CARDS = [
  { taxa: 'Birds',                 count: 251, icon: '/images/icons/bird-icon.png',       count2023: 83  },
  { taxa: 'Plants',                count: 468, icon: '/images/icons/plant-icon.png',      count2023: 260 },
  { taxa: 'Butterflies',           count: 57,  icon: '/images/icons/butterfly-icon.png',  count2023: 56  },
  { taxa: 'Aquatic Inverts',       count: 52,  icon: '/images/icons/aquatic-icon.png',    count2023: 29  },
  { taxa: 'Amphibians & Reptiles', count: 22,  icon: '/images/icons/amphibian-icon.png',  count2023: 12  },
  { taxa: 'Mammals',               count: 13,  icon: '/images/icons/mammal-icon.png',     count2023: 9   },
  { taxa: 'Fish',                  count: 7,   icon: '/images/icons/fish-icon.png',       count2023: 7   },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', paddingBottom: '5rem' }}>

      {/* ── ComforterBrush hero banner ── */}
      <section
        style={{
          background: 'var(--meadow-green)',
          padding: '3rem 2rem 2.75rem',
          textAlign: 'center',
        }}
      >
        <h1
          className="font-comforter"
          style={{
            fontSize: 'clamp(2.2rem, 5vw, 4rem)',
            color: 'var(--golden)',
            lineHeight: 1.15,
            margin: 0,
          }}
        >
          Biodiversity and Research Department
        </h1>
      </section>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>

        {/* ── 870 hero stat ── */}
        <section
          style={{
            textAlign: 'center',
            padding: '2.5rem 1rem 2.75rem',
            borderBottom: '1px solid rgba(12,96,56,0.1)',
            marginBottom: '2.5rem',
          }}
        >
          <p
            style={{
              fontSize: 'clamp(5rem, 12vw, 8rem)',
              fontWeight: 800,
              color: 'var(--meadow-green)',
              lineHeight: 1,
              margin: 0,
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            870
          </p>
          <p
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--outerspace)',
              marginTop: '0.6rem',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            Total Species Recorded
          </p>
          <p
            style={{
              fontSize: '0.9rem',
              color: '#777',
              marginTop: '0.25rem',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            across 7 taxa groups · Nyandungu Eco-Park 2025
          </p>
        </section>

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
                    gap: '0.4rem',
                    textAlign: 'center',
                  }}
                >
                  <Image
                    src={card.icon}
                    alt={card.taxa}
                    width={48}
                    height={48}
                    style={{ objectFit: 'contain' }}
                  />
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
                    {pct > 0
                      ? `▲ +${pct}% since 2023`
                      : pct < 0
                      ? `▼ ${pct}% since 2023`
                      : 'stable since 2023'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Charts ── */}
        <BiodiversityCharts />
      </div>
    </div>
  );
}
