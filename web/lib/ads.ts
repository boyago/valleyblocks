export type AdPlacement = "catalogo" | "jogo";
export type AdConfiguration = {
  enabled: boolean;
  mode: "placeholder" | "partner" | "adsense";
  label: string;
  partner?: { image: string; alt: string; href: string };
  adsense?: { client: string; slot: string };
};

export const ads: Record<AdPlacement, AdConfiguration> = {
  catalogo: { enabled: true, mode: "placeholder", label: "Espaço para anúncio ou parceiro" },
  jogo: { enabled: true, mode: "placeholder", label: "Espaço reservado, separado dos controles" },
};
