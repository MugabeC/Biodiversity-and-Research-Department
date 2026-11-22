import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Species Explorer',
  description: '870 species recorded at Nyandungu Eco-Park, filtered by group and IUCN status.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
