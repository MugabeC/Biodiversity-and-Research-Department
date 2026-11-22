import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Wildlife records',
  description: 'Species recorded inside Nyandungu Eco-Park each month and each year, from iNaturalist and eBird.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
