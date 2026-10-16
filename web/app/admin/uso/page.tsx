import type { Metadata } from 'next';
import { UsageDashboard } from '@/components/usage-dashboard';
export const metadata: Metadata = { title: 'Medição de jogadores', robots: { index: false, follow: false } };
export default function UsagePage() { return <UsageDashboard />; }
