import {
  DOCUMENT_LIBRARY,
  fetchHiddenDocumentIds,
  fetchUploadedDocuments,
} from '@/app/lib/documents';
import DocumentLibrary from './DocumentLibrary';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage() {
  const [uploaded, hidden] = await Promise.all([fetchUploadedDocuments(), fetchHiddenDocumentIds()]);
  const documents = [...uploaded, ...DOCUMENT_LIBRARY.filter(d => !hidden.has(d.id))];
  return (
    <div style={{ paddingBottom: '5rem' }}>
      <div className="page-shell page-shell--spacious">
        <h1 className="sr-only">Documents</h1>

        <DocumentLibrary documents={documents} />
      </div>
    </div>
  );
}
