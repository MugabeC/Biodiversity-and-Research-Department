import { notFound } from 'next/navigation';
import { getAnyDocumentById } from '@/app/lib/documents';
import DocumentViewer from './DocumentViewer';

export const dynamic = 'force-dynamic';

export default async function DocumentViewPage({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
  const doc = await getAnyDocumentById(searchParams.id);
  if (!doc) notFound();

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="page-shell">
        <DocumentViewer doc={doc} />
      </div>
    </div>
  );
}
