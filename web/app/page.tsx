import type { Metadata } from "next";
import { ValleyLanding } from "@/components/valley-landing";
import { PRODUCTS, formatPrice } from "@/lib/products.mjs";
import { SITE_URL } from "@/lib/games";

const title = "ValleyBlocks: jogo de blocos em 3D para construir, explorar e jogar com amigos";
const description = "Construa seu vale, adote um pet, dirija, pesque e atravesse portais para nove terras, do Sertão a Nova York. Grátis no navegador, sem instalar. Android em breve.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "pt_BR", siteName: "ValleyBlocks", url: "/", title, description, images: [{ url: "/jogos/vale-dos-blocos/abertura.jpg", width: 1160, height: 760, alt: "Tela de abertura do ValleyBlocks" }] },
  twitter: { card: "summary_large_image", title, description, images: ["/jogos/vale-dos-blocos/abertura.jpg"] },
};

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org", "@type": "VideoGame", name: "ValleyBlocks", url: SITE_URL, description, inLanguage: "pt-BR", applicationCategory: "Game", operatingSystem: "Web browser, Android", gamePlatform: ["Desktop", "Mobile"], isAccessibleForFree: true,
    offers: [{ "@type": "Offer", name: "Jogar grátis", price: "0", priceCurrency: "BRL" }, { "@type": "Offer", name: PRODUCTS["vale-completo"].title, price: (PRODUCTS["vale-completo"].priceCents / 100).toFixed(2), priceCurrency: "BRL" }],
  };
  return <><ValleyLanding playHref="/jogos/valleyblocks#jogar" buyHref="/comprar/vale-completo" fullPrice={formatPrice(PRODUCTS["vale-completo"].priceCents)} guideHref="/jogos/valleyblocks/como-jogar" accountHref="/conta" privacyHref="/privacidade" termsHref="/termos" contactHref="/contato" /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /></>;
}
