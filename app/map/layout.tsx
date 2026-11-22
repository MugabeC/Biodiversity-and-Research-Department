import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Map',
  description: 'Park boundary, restored area, trails, access trail, survey areas, drainage and roads, with the size of each feature.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
