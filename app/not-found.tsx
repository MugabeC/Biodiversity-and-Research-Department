import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="report-page" style={{ textAlign: 'center', paddingTop: '4rem' }}>
      <h1 className="heading" style={{ margin: '0 0 8px' }}>Page not found</h1>
      <p className="doc-upload-help" style={{ marginBottom: '1.5rem' }}>The page you are looking for does not exist or has moved.</p>
      <Link href="/" className="dash-report-link">Back to the dashboard →</Link>
    </div>
  );
}
