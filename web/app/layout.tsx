import type { Metadata } from "next";
import { Geist, Outfit } from "next/font/google";
import { SITE_NAME, SITE_URL } from "@/lib/games";

// Site type: Geist (self-hosted by next/font at build time, no runtime request to Google).
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
// Display: Outfit pesado nos títulos, com cara de jogo sem virar fonte temática.
const outfit = Outfit({ subsets: ["latin"], weight: ["600", "700", "800", "900"], variable: "--font-outfit", display: "swap" });
import "./globals.css";
import { PrivacyRuntime } from "@/components/privacy-controls";

const description = "Jogue ValleyBlocks, o jogo brasileiro de construir em blocos no navegador, e outros jogos de aventura, corrida e puzzle. Sem download, no computador, tablet ou celular. Comece grátis.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "ValleyBlocks: jogo de construir em blocos 3D no navegador", template: "%s | ValleyBlocks" },
  description,
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION || undefined },
  applicationName: SITE_NAME,
  keywords: ["ValleyBlocks", "jogo de construir blocos online", "jogo estilo Minecraft no navegador", "jogo de blocos brasileiro", "jogos grátis", "jogos online", "jogos no navegador", "jogos sem download", "jogos para celular", "jogos de puzzle", "jogos de ação", "jogos criados com IA"],
  authors: [{ name: "Alexandre Boyago", url: "https://alexandreboyago.com.br" }],
  creator: "Alexandre Boyago",
  publisher: SITE_NAME,
  category: "games",
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "pt_BR", siteName: SITE_NAME, url: "/", title: "ValleyBlocks: jogo de construir em blocos 3D no navegador", description, images: [{ url: "/og.png", width: 1200, height: 630, alt: "ValleyBlocks: jogos no navegador" }] },
  twitter: { card: "summary_large_image", title: "ValleyBlocks: construa, explore e viaje por portais", description, images: ["/og.png"] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/og.png`, founder: { "@type": "Person", name: "Alexandre Boyago", url: "https://alexandreboyago.com.br" }, sameAs: ["https://alexandreboyago.com.br"] },
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: SITE_NAME, description, inLanguage: "pt-BR", publisher: { "@id": `${SITE_URL}/#organization` } },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" className={`${geist.variable} ${outfit.variable}`}><body className="bg-[#0B0B10] text-zinc-100 antialiased">{children}<PrivacyRuntime /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} /></body></html>;
}
