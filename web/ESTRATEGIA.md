# Estratégia LABSGames — revisão de 28/09/2026

## O que esta entrega resolve
- Portal em Next.js/Node.js; CSS e JS atendidos pelo servidor Next, inclusive na Hostinger. A correção antiga de dist/client era específica do Vinext e não deve substituir server.mjs.
- Um iframe por partida, carregamento sob demanda, espera de até 45 segundos para carregamento e início, rotação antes de iniciar, pausa ao voltar a retrato, barra de saída e reinício.
- PAC-MAN retirado dos builds públicos. Seu protótipo permanece arquivado em games/pacman; O Robô e as Peças é outro projeto, com código, mapas, personagens e sons novos.
- Encaixe ganha peças, paleta e capas próprias, preservando regras e salvamentos. A mudança visual não garante ausência de direitos de terceiros.
- Contato público app.boyago@gmail.com; privacidade, termos, preferências de métricas; GA4 opcional e desativado sem configuração e consentimento.
- Sitemap, URLs canônicas, dados estruturados e llms.txt atualizados a partir do catálogo.

## Direitos e publicidade
A política do Google proíbe infração de direitos autorais. Isso não permite afirmar que toda semelhança de mecânica reprova automaticamente um site, nem que trocar um nome resolve todos os direitos. Antes de anúncios, revisar marcas, imagens, músicas, modelos, fontes e licenças; manter comprovantes. Circuito usa modelos fornecidos pelo proprietário, mas a origem local não comprova licença comercial: consultar games/LICENCIAMENTO.md.

Os banners continuam demonstrativos. Credenciais, aprovação de conta/site, consentimento aplicável e revisão dos ativos precedem a ativação real. Conta AdSense pode ser individual ou empresarial; MEI não é requisito universal do produto. Enquadramento tributário depende da atividade e deve ser definido com apoio contábil.

Fontes oficiais:
- [Propriedade intelectual — Google Publisher Policies](https://support.google.com/publisherpolicies/answer/10402772?hl=en)
- [Contas individuais e empresariais no AdSense](https://support.google.com/adsense/answer/10163?hl=en-GB)
- [Privacidade e mensagens do AdSense](https://support.google.com/adsense/answer/10924669?hl=en)
- [Recomendações da ANPD sobre cookies](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-emite-recomendacoes-para-adequacao-da-pratica-de-coleta-de-cookies-do-portal-gov-br)

## SEO e descoberta por IA
Priorizar páginas indexáveis com conteúdo útil, títulos próprios, desempenho e links internos. Enviar sitemap no Search Console e acompanhar cobertura. Os dados estruturados descrevem o conteúdo, sem garantir destaque. FAQ visível ajuda o jogador; rich results de FAQ são restritos principalmente a sites governamentais e de saúde reconhecidos. llms.txt é um arquivo descritivo opcional: o Google não exige arquivo especial para suas experiências de IA. Não há garantia de citação ou tráfego.

- [Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [Google: mudanças nos resultados de FAQ](https://developers.google.com/search/blog/2023/08/howto-faq-changes)

## Receita: medir antes de projetar
Não existe RPM garantido. País, dispositivo, inventário, consentimento, bloqueadores, sazonalidade e demanda alteram resultados. Use receita estimada = visualizações / 1.000 × RPM observado. Exemplos puramente hipotéticos para receita bruta de R$ 5.000/mês:
| RPM hipotético | Visualizações mensais necessárias |
| --- | ---: |
| R$ 2 | 2.500.000 |
| R$ 5 | 1.000.000 |
| R$ 8 | 625.000 |

Esses valores não são previsão de mercado. Deduzir hospedagem, ferramentas de IA, produção, revisão, suporte, tributos e aquisição de público. Não tratar criação com IA como custo zero.

Banners de parceiros podem ser testados com propostas transparentes e tráfego medido, sem inventar audiência. Jogos sob encomenda são outra oferta possível, com escopo e direitos definidos. Distribuição em portais pode ampliar alcance, mas exige avaliar contratos, exclusividade, SDK, critérios e divisão de receita atuais. Não foi enviada proposta nem criada integração. Intersticiais/vídeos recompensados são fase futura e mudariam o contrato atual, que mantém anúncios fora do jogo.

## Plano de 90 dias
1. Dias 1–15: publicar esta versão; conferir domínio/HTTPS, assets, navegação e consentimento; testar Android e iPhone reais; registrar licenças; concluir revisão dos textos de privacidade e termos com os dados operacionais da hospedagem.
2. Dias 16–30: configurar Search Console e GA4 se desejado; observar início/falha/conclusão por jogo e origem de tráfego; corrigir gargalos. As métricas refletem só visitantes que autorizaram.
3. Dias 31–60: lançar jogos originais conforme capacidade de teste, comparar retenção usando métricas apropriadas e feedback voluntário. Propor um piloto de parceiro apenas com dados observados.
4. Dias 61–90: avaliar AdSense e distribuição externa após os requisitos; comparar receita líquida e custo por jogo. Ampliar o catálogo de acordo com evidências, sem metas arbitrárias de visitas ou renda.

## Pendências fora do código
- Aprovação AdSense, IDs reais e eventual ads.txt fornecido pela conta.
- Propriedade Search Console (DNS ou token) e envio do sitemap.
- ID GA4, configuração de retenção e desativação de medição aprimorada para manter o escopo documentado.
- Licenças comerciais comprovadas dos modelos/efeitos de terceiros.
- Definição e conferência da retenção dos logs da hospedagem e atendimento de solicitações.
- Teste em aparelhos reais, especialmente Safari/iPhone. Emulação não substitui esse teste.
