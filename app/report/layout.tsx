import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Monthly Summary',
  description: 'One-page monthly summary of school visits, community activities, research, conflicts and waste at Nyandungu Eco-Park.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
