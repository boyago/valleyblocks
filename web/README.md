# LABSGames

Portal de jogos gratuitos para navegador. O portal fica nesta pasta; cada jogo é desenvolvido de forma independente em `../games/`.

## Executar o portal

```powershell
cd D:\projetos\Games\imersao\site
npm install
npm run dev -- --port 5174
```

Abra `http://localhost:5174`. Para gerar a versão de produção, use `npm run build`.

## Adicionar ou atualizar um jogo

1. O jogo deve ser criado em `D:\projetos\Games\imersao\games\<slug>` e gerar um build web na pasta `dist`.
2. Atualize o registro em `D:\projetos\Games\imersao\games\catalogo.json` com nome, descrição, categoria, status, controles, dispositivos e URLs.
3. Execute `npm run build` dentro de `site`. O script de sincronização copia o catálogo e os builds existentes para o portal.

O jogo não deve alterar `site/`. O portal não importa o código-fonte de um jogo: ele o mostra em um iframe e conversa pelo protocolo definido em `../games/CONTRATO.md`.

## Trocar textos e imagens

- Textos e dados de um jogo: `../games/catalogo.json`.
- Capa e miniatura: coloque os arquivos no build do jogo para que estejam disponíveis em `/games/<slug>/`. Os campos `capa` e `miniatura` do catálogo apontam para eles.
- Textos institucionais: `app/sobre/page.tsx` e `app/parceiros/page.tsx`.
- Cores e tipografia: `app/globals.css`.

## Configurar publicidade

Edite `lib/ads.ts`.

- `enabled: false` oculta uma posição.
- `mode: "placeholder"` mostra a área reservada atual.
- `mode: "partner"` exige `image`, `alt` e `href` do parceiro.
- `mode: "adsense"` guarda `client` e `slot` para a integração do anúncio.

A integração real exige aprovação, direitos dos ativos, IDs e consentimento aplicável. Siga CONFIGURACAO.md; o modo adsense atual não injeta scripts. Não coloque anúncios dentro ou sobre a área do jogo.

## Configuração de lançamento

Veja [CONFIGURACAO.md](CONFIGURACAO.md) para contato, métricas opcionais, Search Console, publicidade e validações. A análise revisada está em [ESTRATEGIA.md](ESTRATEGIA.md).
