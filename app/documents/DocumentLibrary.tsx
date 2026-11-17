'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  DOCUMENT_CATEGORIES,
  documentCategory,
  documentHref,
  documentTypeLabel,
  formatFileSize,
  type DocumentCategory,
  type LibraryDocument,
} from '@/app/lib/documents';
import RemoveButton from './RemoveButton';

export default function DocumentLibrary({ documents }: { documents: LibraryDocument[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<DocumentCategory | 'All'>('All');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter(d =>
      (category === 'All' || documentCategory(d) === category) &&
      (!q || d.title.toLowerCase().includes(q) || d.description.toLowerCase().includes(q) || d.filename.toLowerCase().includes(q)),
    );
  }, [documents, query, category]);

  return (
    <>
      <input
        type="search"
        className="species-search"
        placeholder="Search documents…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={{ marginBottom: '1rem', maxWidth: 480 }}
      />
      <div className="dash-chips" style={{ marginBottom: '1.75rem' }}>
        {(['All', ...DOCUMENT_CATEGORIES] as const).map(c => (
          <button
            key={c}
            type="button"
            className={`dash-chip${category === c ? ' dash-chip--active' : ''}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="doc-upload-help">No documents match your search.</p>
      ) : (
        <div className="doc-library-grid">
          {shown.map(doc => {
            const href = documentHref(doc);
            return (
              <article key={doc.id} className="glass-card doc-library-card">
                <div className="doc-library-card-head">
                  <span className={`doc-type-badge doc-type-badge--${doc.type}`}>{documentTypeLabel(doc.type)}</span>
                  <h2 className="heading doc-library-card-title">{doc.title}</h2>
                </div>
                <p className="doc-library-card-desc">
                  {doc.description}
                  {doc.uploaded && (
                    <span className="doc-upload-meta">
                      {doc.description ? ' · ' : ''}Added{' '}
                      {new Date(doc.uploadedAt ?? '').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Kigali' })}
                      {doc.sizeBytes ? ` · ${formatFileSize(doc.sizeBytes)}` : ''}
                    </span>
                  )}
                </p>
                <div className="doc-library-card-actions">
                  <Link href={`/documents/view?id=${doc.id}`} className="doc-action-btn doc-action-btn--primary">View</Link>
                  <a href={href} download={doc.filename} className="doc-action-btn doc-action-btn--ghost">Download</a>
                  {doc.uploaded && <RemoveButton id={doc.id} title={doc.title} />}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
