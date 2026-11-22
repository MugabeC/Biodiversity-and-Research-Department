'use client';

import Link from 'next/link';
import { FORM_SPECS } from '@/app/lib/formSpec';
import { lockStaff } from '@/app/lib/staffAuth';

const SECTIONS: { id: 'community' | 'habitat' | 'aquatic'; title: string; intro: string }[] = [
  { id: 'community', title: 'Community Conservation', intro: 'School visits, community engagement, complimentary admissions, internship applications, research requests and conflict cases.' },
  { id: 'habitat', title: 'Habitat Restoration', intro: 'Waste management. Restoration area, invasive species removal and the planting list are coming next.' },
  { id: 'aquatic', title: 'Aquatic Ecosystems', intro: 'Water test results. Each result is scored against the Rwanda freshwater limits.' },
];


export default function StaffToolsPage() {
  return (
    <div className="report-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 className="heading" style={{ margin: '0 0 6px' }}>Staff data tools</h1>
        <button type="button" className="entry-link" onClick={lockStaff}>Lock staff tools</button>
      </div>
      <p className="doc-upload-help" style={{ marginBottom: '1.5rem', maxWidth: 720 }}>
        Add records here and the dashboard updates within a minute. These forms start from 22 November 2026. Earlier records came from the audited workbook.
      </p>

      {SECTIONS.map(sec => (
        <section key={sec.id} style={{ marginBottom: '2rem' }}>
          <h2 className="doc-upload-title" style={{ marginBottom: 4 }}>{sec.title}</h2>
          <p className="doc-upload-help" style={{ marginBottom: 12, maxWidth: 720 }}>{sec.intro}</p>
          <div className="hub-grid">
            {FORM_SPECS.filter(f => f.section === sec.id).map(f => (
              <Link key={f.id} href={`/update/forms/${f.id}`} className="glass-card hub-card">
                <span className="hub-card-title">{f.title}</span>
                <span className="doc-upload-help">{f.blurb}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section style={{ marginBottom: '2rem' }}>
        <h2 className="doc-upload-title" style={{ marginBottom: 4 }}>Wildlife Conservation</h2>
        <p className="doc-upload-help" style={{ marginBottom: 12, maxWidth: 720 }}>Species records come from iNaturalist and eBird on their own, so there is nothing to type in.</p>
        <div className="hub-grid">
          <Link href="/update/wildlife" className="glass-card hub-card">
            <span className="hub-card-title">Wildlife records</span>
            <span className="doc-upload-help">Check the nightly update, update now, and connect eBird.</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
