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

      <div className="hub-sections">
        {SECTIONS.map(sec => (
          <section key={sec.id} className={`hub-section hub-section--${sec.id}`}>
            <h2 className="hub-section-title">{sec.title}</h2>
            <div className="hub-buttons">
              {FORM_SPECS.filter(f => f.section === sec.id).map(f => (
                <Link key={f.id} href={`/update/forms/${f.id}`} className="doc-action-btn doc-action-btn--primary">{f.title}</Link>
              ))}
            </div>
          </section>
        ))}

        <section className="hub-section hub-section--wildlife">
          <h2 className="hub-section-title">Wildlife Conservation</h2>
          <div className="hub-buttons">
            <Link href="/update/wildlife" className="doc-action-btn doc-action-btn--primary">Wildlife records</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
