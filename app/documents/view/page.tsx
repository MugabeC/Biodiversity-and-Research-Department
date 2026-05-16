import { notFound } from 'next/navigation';
import { getDocumentById } from '@/app/lib/documents';
import DocumentViewer from './DocumentViewer';

export default function DocumentViewPage({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
  const doc = getDocumentById(searchParams.id);
  if (!doc) notFound();

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem 1.5rem 0' }}>
        <DocumentViewer doc={doc} />
      </div>
    </div>
  );
}
