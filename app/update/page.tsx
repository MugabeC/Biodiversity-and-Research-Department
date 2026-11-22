'use client';

import Link from 'next/link';
import { FORM_SPECS } from '@/app/lib/formSpec';
import { lockStaff } from '@/app/lib/staffAuth';

const SECTIONS: { id: 'community' | 'habitat' | 'aquatic'; title: string }[] = [
  { id: 'community', title: 'Community Conservation' },
  { id: 'habitat', title: 'Habitat Restoration' },
  { id: 'aquatic', title: 'Aquatic Ecosystems' },
];

export default function StaffToolsPage() {
  return (
    <div className="report-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <h1 className="heading" style={{ margin: 0 }}>Staff data tools</h1>
        <button type="button" className="entry-link" onClick={lockStaff}>Lock staff tools</button>
      </div>

      {SECTIONS.map(sec => (
        <section key={sec.id} style={{ marginBottom: '2rem' }}>
          <h2 className="doc-upload-title" style={{ marginBottom: 12 }}>{sec.title}</h2>
          <div className="hub-grid">
            {FORM_SPECS.filter(f => f.section === sec.id).map(f => (
              <Link key={f.id} href={`/update/forms/${f.id}`} className="glass-card hub-card">
                <span className="hub-card-title">{f.title}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section style={{ marginBottom: '2rem' }}>
        <h2 className="doc-upload-title" style={{ marginBottom: 12 }}>Wildlife Conservation</h2>
        <div className="hub-grid">
          <Link href="/update/wildlife" className="glass-card hub-card">
            <span className="hub-card-title">Wildlife records</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
