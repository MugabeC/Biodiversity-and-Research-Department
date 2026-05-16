'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { LibraryDocument } from '@/app/lib/documents';
import { documentHref, documentTypeLabel } from '@/app/lib/documents';

export default function DocumentViewer({ doc }: { doc: LibraryDocument }) {
  const href = documentHref(doc);
  const [absoluteUrl, setAbsoluteUrl] = useState('');

  useEffect(() => {
    setAbsoluteUrl(`${window.location.origin}${href}`);
  }, [href]);

  const officeEmbed =
    absoluteUrl && (doc.type === 'word' || doc.type === 'excel')
      ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absoluteUrl)}`
      : null;

  return (
    <div className="doc-viewer-page">
      <div className="doc-viewer-toolbar">
        <Link href="/documents" className="doc-action-btn doc-action-btn--ghost">
          ← Back to documents
        </Link>
        <div className="doc-viewer-toolbar-meta">
          <span className={`doc-type-badge doc-type-badge--${doc.type}`}>
            {documentTypeLabel(doc.type)}
          </span>
          <h1 className="heading doc-viewer-title">{doc.title}</h1>
        </div>
        <div className="doc-viewer-toolbar-actions">
          <a href={href} target="_blank" rel="noopener noreferrer" className="doc-action-btn doc-action-btn--ghost">
            Open in new tab
          </a>
          <a href={href} download={doc.filename} className="doc-action-btn doc-action-btn--primary">
            Download
          </a>
        </div>
      </div>

      <div className="doc-viewer-frame-wrap glass-card">
        {doc.type === 'pdf' && (
          <iframe title={doc.title} src={href} className="doc-viewer-frame" />
        )}
        {officeEmbed && (
          <iframe title={doc.title} src={officeEmbed} className="doc-viewer-frame" allowFullScreen />
        )}
        {(doc.type === 'word' || doc.type === 'excel') && !absoluteUrl && (
          <p className="doc-viewer-loading">Loading preview…</p>
        )}
      </div>

      {(doc.type === 'word' || doc.type === 'excel') && (
        <p className="doc-viewer-hint">
          Office preview is provided by Microsoft Office Online. If the preview does not load, use{' '}
          <strong>Download</strong> or <strong>Open in new tab</strong>.
        </p>
      )}
    </div>
  );
}
