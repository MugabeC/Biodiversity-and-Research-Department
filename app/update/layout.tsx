import type { Metadata } from 'next';
import StaffGate from '@/app/components/StaffGate';

export const metadata: Metadata = {
  title: 'Staff data tools',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <StaffGate>{children}</StaffGate>;
}
