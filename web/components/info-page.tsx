import type { ReactNode } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-header";
export function InfoPage({ title, children }: { title: string; children: ReactNode }) {
  return <div className="min-h-screen"><SiteHeader /><main className="mx-auto max-w-3xl px-5 py-12 sm:px-8"><h1 className="mb-8 text-4xl font-black tracking-tight">{title}</h1><div className="space-y-6 text-base leading-7 text-zinc-300 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-white [&_a]:text-[#D86BFF] [&_a]:underline">{children}</div></main><SiteFooter /></div>;
}
