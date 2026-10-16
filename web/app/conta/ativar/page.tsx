import { Suspense } from 'react';
import { AccountForm } from '@/components/account-form';
export const metadata = { title: 'Ativar conta', robots: { index: false, follow: false }, referrer: 'no-referrer' as const };
export default function Page() { return <Suspense fallback={null}><AccountForm activate /></Suspense>; }
