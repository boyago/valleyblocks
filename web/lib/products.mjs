// Catálogo de produtos do piloto. Preços são hipóteses de teste (ver ESTRATEGIA.md);
// ajuste aqui e o checkout, a conta e o painel passam a refletir o novo valor.
export const PRODUCTS = Object.freeze({
  'vale-completo': Object.freeze({ title: 'Vale dos Blocos · versão completa', description: 'Sem limite diário de tempo, salvamento na nuvem (um mundo, até 4 MB) e multiplayer: crie salas e jogue com até 3 amigos.', priceCents: 2990, grants: Object.freeze(['unlimited', 'cloud']) }),
  'vale-aparencias-expedicao': Object.freeze({ title: 'Vale dos Blocos · Pacote Expedição', description: 'Quatro aparências com acessórios exclusivos: Capitão do Vale, Minerador, Guarda-florestal e Astronauta de Bloco.', priceCents: 990, grants: Object.freeze(['outfits:expedicao']) }),
  'vale-nuvem': Object.freeze({ title: 'Vale dos Blocos · salvamento na nuvem', description: 'Guarde seu mundo no servidor e continue em outro aparelho. Mantém o limite diário de 60 minutos.', priceCents: 990, grants: Object.freeze(['cloud']) }),
});
export const CURRENCY = 'BRL';
export const formatPrice = cents => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: CURRENCY });
export const productList = () => Object.entries(PRODUCTS).map(([code, p]) => ({ code, title: p.title, description: p.description, priceCents: p.priceCents, price: formatPrice(p.priceCents), grants: [...p.grants] }));
