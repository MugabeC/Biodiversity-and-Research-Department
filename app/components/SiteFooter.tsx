import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="site-footer-line">
        Designed by <strong>Mugabe Christian</strong>
        {' · '}
        Contribution by Biodiversity and Research Department | QA parks and Wetland Solution | Nyandungu Eco Park
        {' · '}
        <Link href="/update" className="site-footer-staff">Staff: update data</Link>
      </p>
    </footer>
  );
}
