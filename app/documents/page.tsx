const DOCUMENTS = [
  {
    title: 'School Visits',
    description: 'Monthly student visit totals and individual school records.',
    href: '/data/school_visits.json',
  },
  {
    title: 'Water Quality',
    description: 'WASAC compliance sampling — October 2025.',
    href: '/data/water_quality.json',
  },
  {
    title: 'Community Activities',
    description: 'Community engagement and outreach records.',
    href: '/data/community_activities.json',
  },
  {
    title: 'Complementary Passes',
    description: 'Complimentary visitor pass records.',
    href: '/data/complementary_passes.json',
  },
  {
    title: 'Waste Management',
    description: 'Waste collection and management data.',
    href: '/data/waste.json',
  },
  {
    title: 'Biodiversity Summary',
    description: 'Species counts by taxa — 2023 vs 2025.',
    href: '/data/summary.json',
  },
  {
    title: 'Species Checklist',
    description: 'Full merged species dataset (870 species).',
    href: '/data/species/species.json',
  },
];

export default function DocumentsPage() {
  return (
    <div style={{ paddingBottom: '5rem' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2.5rem 1.5rem 0' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 className="heading" style={{ fontSize: '32px', color: 'var(--meadow-green)', margin: 0, lineHeight: 1.2 }}>
            Documents
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', margin: '8px 0 0' }}>
            Research data exports · Nyandungu Eco-Park
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {DOCUMENTS.map((doc) => (
            <a
              key={doc.href}
              href={doc.href}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-card"
              style={{
                display: 'block',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
            >
              <h2 className="heading" style={{ fontSize: '18px', color: 'var(--meadow-green)', margin: '0 0 8px' }}>
                {doc.title}
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>
                {doc.description}
              </p>
              <span style={{ fontSize: '13px', color: 'var(--meadow-green)' }}>
                Open JSON ↗
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
