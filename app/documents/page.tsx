import {
  DOCUMENT_LIBRARY,
  fetchUploadedDocuments,
} from '@/app/lib/documents';
import UploadPanel from './UploadPanel';
import DocumentLibrary from './DocumentLibrary';

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

        <DocumentLibrary documents={documents} />
      </div>
    </div>
  );
}
