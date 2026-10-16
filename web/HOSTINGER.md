# Publicação na Hostinger

Domínio definitivo: https://labsgames.cloud. Contato padrão: app.boyago@gmail.com. Consulte CONFIGURACAO.md para métricas opcionais, Search Console e publicidade. A versão Node atual usa Next.js, não o worker legado Vinext/dist/client.

O portal está pronto para uma aplicação Node.js gerenciada. Use Node.js 22 (o projeto declara essa exigência em `package.json` e `.nvmrc`).

## Configuração no hPanel

1. Em **Sites**, escolha **Adicionar site** e depois **Aplicação Web Node.js**.
2. Conecte o GitHub e selecione `boyago/labsgames`, branch `main`.
3. Mantenha o diretório raiz como `/`.
4. Use `npm run build` como comando de compilação e `npm start` como comando de inicialização.
5. Confirme a versão 22 do Node.js e publique.

O `server.cjs` inicia o Next.js na porta entregue pela variável `PORT` da Hostinger. Ele pode ser usado como arquivo de entrada pelo hPanel ou por `npm start`. As builds dos jogos são abertas como arquivos `index.html` dentro de `public/games`, e os arquivos CSS e JavaScript do portal são servidos pelo próprio Next.js. A versão com contas, quotas e mundos remotos exige variáveis privadas no ambiente e flags no build; consulte docs/ACCOUNTS.md, docs/GAME-USAGE.md e docs/WORLDS.md antes de publicar.

## Depois da publicação

- Conecte o domínio no hPanel e habilite o SSL gerenciado.
- Acompanhe o primeiro deploy pelo log de compilação.
- Cada envio para a branch `main` poderá disparar uma nova implantação, conforme a integração escolhida no hPanel.

Referência: [guia da Hostinger para implantar aplicações criadas com Codex](https://www.hostinger.com/br/support/como-implantar-aplicativos-criados-com-codex-na-hostinger/).
