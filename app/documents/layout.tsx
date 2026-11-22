import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documents',
  description: 'Park policies, plans, reports and data workbooks to view or download.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
