import Image from 'next/image';
import dynamic from 'next/dynamic';

const BiodiversityCharts    = dynamic(() => import('./components/BiodiversityCharts'),    { ssr: false });
const TaxaDistributionChart = dynamic(() => import('./components/TaxaDistributionChart'), { ssr: false });
const StudentVisitsChart    = dynamic(() => import('./components/StudentVisitsChart'),    { ssr: false });
const WaterQualityChart     = dynamic(() => import('./components/WaterQualityChart'),     { ssr: false });

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
    <div style={{ paddingBottom: '5rem' }}>

      {/* ── Title — ComforterBrush via inline style, no Tailwind ── */}
      <section style={{ textAlign: 'center', padding: '3rem 2rem 0' }}>
        <h1
          style={{
            fontFamily: 'ComforterBrush, cursive',
            fontSize: 'clamp(36px, 5vw, 64px)',
            color: '#F5A623',
            lineHeight: 1.15,
            margin: 0,
          }}
        >
          Biodiversity and Research Department
        </h1>
        <p
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 500,
            fontSize: '16px',
            color: '#4A5E4F',
            margin: '8px 0 0',
          }}
        >
          Nyandungu Eco-Park
        </p>
      </section>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1.5rem' }}>

        {/* ── 870 hero ── */}
        <section style={{ textAlign: 'center', marginTop: '24px', marginBottom: '32px' }}>
          <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 900, fontSize: '96px', color: '#0C6038', lineHeight: 1, margin: 0 }}>
            870
          </p>
          <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '20px', color: '#4A5E4F', margin: '0.5rem 0 0.25rem' }}>
            Total Species Recorded
          </p>
          <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 400, fontSize: '15px', color: '#4A5E4F', margin: 0, opacity: 0.7 }}>
            across 7 taxa groups · Nyandungu Eco-Park · 2025 Biodiversity Survey
          </p>
        </section>

        {/* ── Taxa cards — 4 cols desktop, 2 tablet, 1 mobile ── */}
        <section style={{ marginBottom: '40px' }}>
          <div className="taxa-grid">
            {TAXA_CARDS.map((card) => (
              <div
                key={card.taxa}
                className="taxa-card"
                style={{
                  position: 'relative',
                  overflow: 'visible',
                  background: 'rgba(255,255,255,0.5)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.6)',
                  borderRadius: '20px',
                  boxShadow: '0 8px 32px rgba(12,96,56,0.10)',
                  padding: '48px 24px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {/* Floating icon — overflows card top edge */}
                <div style={{ position: 'absolute', top: '-28px', left: '20px' }}>
                  <Image
                    src={card.icon}
                    alt={card.taxa}
                    width={64}
                    height={64}
                    style={{
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))',
                      display: 'block',
                    }}
                  />
                </div>

                {/* Badge — top-right */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <span
                    style={{
                      background: card.stable ? 'rgba(74,94,79,0.1)' : 'rgba(12,96,56,0.12)',
                      color: card.stable ? '#4A5E4F' : '#0C6038',
                      borderRadius: '9999px',
                      padding: '3px 10px',
                      fontFamily: 'Poppins, sans-serif',
                      fontWeight: 700,
                      fontSize: '12px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {card.badge}
                  </span>
                </div>

                {/* Taxa name */}
                <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', color: '#4A5E4F', margin: 0 }}>
                  {card.taxa}
                </p>

                {/* Count */}
                <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '42px', color: '#0C6038', margin: 0, lineHeight: 1 }}>
                  {card.count}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Charts — 2×2 grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <BiodiversityCharts />
          <TaxaDistributionChart />
          <StudentVisitsChart />
          <WaterQualityChart />
        </div>

      </div>
    </div>
  );
}
