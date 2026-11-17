import Link from 'next/link';
import {
  DOCUMENT_LIBRARY,
  documentHref,
  documentTypeLabel,
  fetchUploadedDocuments,
  formatFileSize,
} from '@/app/lib/documents';
import UploadPanel from './UploadPanel';
import RemoveButton from './RemoveButton';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage() {
  const uploaded = await fetchUploadedDocuments();
  const documents = [...uploaded, ...DOCUMENT_LIBRARY];
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

        <UploadPanel />

        <div className="doc-library-grid">
          {documents.map(doc => {
            const href = documentHref(doc);
            return (
              <article key={doc.id} className="glass-card doc-library-card">
                <div className="doc-library-card-head">
                  <span className={`doc-type-badge doc-type-badge--${doc.type}`}>
                    {documentTypeLabel(doc.type)}
                  </span>
                  <h2 className="heading doc-library-card-title">{doc.title}</h2>
                </div>
                <p className="doc-library-card-desc">
                  {doc.description}
                  {doc.uploaded && (
                    <span className="doc-upload-meta">
                      {doc.description ? ' · ' : ''}Added {new Date(doc.uploadedAt ?? '').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Kigali' })}
                      {doc.sizeBytes ? ` · ${formatFileSize(doc.sizeBytes)}` : ''}
                    </span>
                  )}
                </p>
                <div className="doc-library-card-actions">
                  <Link href={`/documents/view?id=${doc.id}`} className="doc-action-btn doc-action-btn--primary">
                    View
                  </Link>
                  <a href={href} download={doc.filename} className="doc-action-btn doc-action-btn--ghost">
                    Download
                  </a>
                  {doc.uploaded && <RemoveButton id={doc.id} title={doc.title} />}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
