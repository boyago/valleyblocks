import { AccountFlow } from '@/components/account-flows';
export const metadata = { title: 'Nova senha', robots: { index: false, follow: false }, referrer: 'no-referrer' as const };
export default function Page() { return <AccountFlow mode="reset" />; }
