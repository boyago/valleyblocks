import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { CheckoutPage } from '@/components/checkout-page';
import { PRODUCTS, productList } from '@/lib/products.mjs';

export const metadata = { title: 'Finalizar compra', robots: { index: false, follow: false }, referrer: 'no-referrer' as const };
export function generateStaticParams() { return Object.keys(PRODUCTS).map(product => ({ product })); }

export default async function Page({ params }: { params: Promise<{ product: string }> }) {
  const { product } = await params;
  const item = productList().find(p => p.code === product);
  if (!item) notFound();
  return <Suspense fallback={null}><CheckoutPage product={item} /></Suspense>;
}
