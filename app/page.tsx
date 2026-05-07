import Image from 'next/image';
import BiodiversityCharts from './components/BiodiversityCharts';

const TAXA_CARDS = [
  { taxa: 'Birds',                 count: 251, icon: '/images/icons/bird-icon.png',       badge: '▲ +202%', stable: false },
  { taxa: 'Plants',                count: 468, icon: '/images/icons/plant-icon.png',      badge: '▲ +80%',  stable: false },
  { taxa: 'Butterflies',           count: 57,  icon: '/images/icons/butterfly-icon.png',  badge: '▲ +2%',   stable: false },
  { taxa: 'Aquatic Inverts',       count: 52,  icon: '/images/icons/aquatic-icon.png',    badge: '▲ +79%',  stable: false },
  { taxa: 'Amphibians & Reptiles', count: 22,  icon: '/images/icons/amphibian-icon.png',  badge: '▲ +83%',  stable: false },
  { taxa: 'Mammals',               count: 13,  icon: '/images/icons/mammal-icon.png',     badge: '▲ +44%',  stable: false },
  { taxa: 'Fish',                  count: 7,   icon: '/images/icons/fish-icon.png',       badge: 'stable',  stable: true  },
];

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#F7F5EF', paddingBottom: '5rem' }}>

      {/* ── Dark green header band ── */}
      <section style={{ background: '#2D4C39', padding: '3rem 2rem 2.75rem', textAlign: 'center' }}>
        <h1
          className="font-comforter"
          style={{
            fontSize: 'clamp(36px, 5vw, 64px)',
            color: '#F5A623',
            lineHeight: 1.15,
            margin: 0,
          }}
        >
          Biodiversity and Research Department
        </h1>
      </section>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1.5rem' }}>

        {/* ── 870 hero number ── */}
        <section
          style={{
            textAlign: 'center',
            padding: '4rem 1rem 3rem',
            borderBottom: '1px solid #E0E8E2',
            marginBottom: '3rem',
          }}
        >
          <p
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 900,
              fontSize: '96px',
              color: '#0C6038',
              lineHeight: 1,
              margin: 0,
            }}
          >
            870
          </p>
          <p
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 600,
              fontSize: '20px',
              color: '#4A5E4F',
              margin: '0.6rem 0 0.3rem',
            }}
          >
            Total Species Recorded
          </p>
          <p
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 400,
              fontSize: '15px',
              color: '#4A5E4F',
              margin: 0,
              opacity: 0.75,
            }}
          >
            across 7 taxa groups · Nyandungu Eco-Park · 2025 Biodiversity Survey
          </p>
        </section>

        {/* ── Taxa cards — 3 columns desktop, 2 tablet, 1 mobile ── */}
        <section style={{ marginBottom: '4rem' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {TAXA_CARDS.map((card) => (
              <div
                key={card.taxa}
                className="taxa-card"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E0E8E2',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Image
                    src={card.icon}
                    alt={card.taxa}
                    width={48}
                    height={48}
                    style={{ objectFit: 'contain' }}
                  />
                  <span
                    style={{
                      background: card.stable ? '#F0F4F1' : '#E8F5EE',
                      color: card.stable ? '#4A5E4F' : '#0C6038',
                      borderRadius: '9999px',
                      padding: '4px 12px',
                      fontFamily: 'Poppins, sans-serif',
                      fontWeight: 700,
                      fontSize: '13px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {card.badge}
                  </span>
                </div>
                <div>
                  <p
                    style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontWeight: 600,
                      fontSize: '16px',
                      color: '#4A5E4F',
                      margin: '0 0 4px',
                    }}
                  >
                    {card.taxa}
                  </p>
                  <p
                    style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontWeight: 600,
                      fontSize: '40px',
                      color: '#0C6038',
                      margin: 0,
                      lineHeight: 1,
                    }}
                  >
                    {card.count}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Charts ── */}
        <BiodiversityCharts />
      </div>
    </div>
  );
}
