'use client';

import Link from 'next/link';
import { FORM_SPECS } from '@/app/lib/formSpec';

const SECTIONS: { id: 'community' | 'habitat'; title: string; intro: string }[] = [
  { id: 'community', title: 'Community Conservation', intro: 'School visits, community engagement, complimentary admissions, internship applications, research requests and conflict cases.' },
  { id: 'habitat', title: 'Habitat Restoration', intro: 'Waste management. Restoration area, invasive species removal and the planting list are coming next.' },
];

const COMING: { title: string; text: string }[] = [
  { title: 'Wildlife Conservation', text: 'Species records from eBird and iNaturalist for Nyandungu, with monthly and yearly counts.' },
  { title: 'Aquatic Ecosystems', text: 'Water test results and water quality percentages.' },
];

export default function StaffToolsPage() {
  return (
    <div className="report-page">
      <h1 className="heading" style={{ margin: '0 0 6px' }}>Staff data tools</h1>
      <p className="doc-upload-help" style={{ marginBottom: '1.5rem', maxWidth: 720 }}>
        Add records here and the dashboard updates within a minute. You need the staff password, which is asked for once per visit.
        These forms start from 22 November 2026. Earlier records came from the audited workbook.
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
        <h2 className="doc-upload-title" style={{ marginBottom: 4 }}>Coming next</h2>
        <div className="hub-grid">
          {COMING.map(c => (
            <div key={c.title} className="glass-card hub-card hub-card--soon">
              <span className="hub-card-title">{c.title}</span>
              <span className="doc-upload-help">{c.text}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="doc-upload-title" style={{ marginBottom: 4 }}>Bulk upload</h2>
        <p className="doc-upload-help" style={{ marginBottom: 12, maxWidth: 720 }}>
          To correct or replace the earlier records, upload the whole data-entry workbook. Records saved from the forms are added on top of it.
        </p>
        <Link href="/update/workbook" className="glass-card hub-card" style={{ maxWidth: 360 }}>
          <span className="hub-card-title">Upload the workbook</span>
          <span className="doc-upload-help">Check it against its own monthly summary, then publish.</span>
        </Link>
      </section>
    </div>
  );
}
