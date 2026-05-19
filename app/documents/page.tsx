import Link from 'next/link';
import {
  DOCUMENT_LIBRARY,
  documentHref,
  documentTypeLabel,
} from '@/app/lib/documents';

export default function DocumentsPage() {
  return (
    <div style={{ paddingBottom: '5rem' }}>
      <div className="page-shell page-shell--spacious">
        <div style={{ marginBottom: '2rem' }}>
          <h1 className="heading" style={{ fontSize: '32px', color: 'var(--meadow-green)', margin: 0, lineHeight: 1.2 }}>
            Documents
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', margin: '8px 0 0' }}>
            Park policies, plans, and research files · Nyandungu Eco-Park
          </p>
        </div>

        <div className="doc-library-grid">
          {DOCUMENT_LIBRARY.map(doc => {
            const href = documentHref(doc);
            return (
              <article key={doc.id} className="glass-card doc-library-card">
                <div className="doc-library-card-head">
                  <span className={`doc-type-badge doc-type-badge--${doc.type}`}>
                    {documentTypeLabel(doc.type)}
                  </span>
                  <h2 className="heading doc-library-card-title">{doc.title}</h2>
                </div>
                <p className="doc-library-card-desc">{doc.description}</p>
                <div className="doc-library-card-actions">
                  <Link href={`/documents/view?id=${doc.id}`} className="doc-action-btn doc-action-btn--primary">
                    View
                  </Link>
                  <a href={href} download={doc.filename} className="doc-action-btn doc-action-btn--ghost">
                    Download
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
