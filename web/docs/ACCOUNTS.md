# Contas, administrador e tempo diário — piloto

## Entrega

- `/conta/entrar`: login por usuário e senha; `/conta`: sessão e troca de senha.
- `/admin`: criar convites e conceder/revogar tempo ilimitado e nuvem separadamente.
- `/admin/uso`: painel de métricas, agora protegido pela sessão administrativa.
  A antiga chave Bearer de métricas não dá mais acesso.
- Convites expiram em 24 horas e só funcionam uma vez. São transportados no
  fragmento da URL, removido da barra quando a tela de ativação abre.
- Senhas com scrypt, salt individual, 12–128 caracteres; tokens aleatórios
  armazenados somente como SHA-256. Cookie HttpOnly/SameSite=Strict por 12 horas.
- Origem verificada nas mutações; tentativa de login limitada por conta e por
  orçamento global no banco, compartilhado entre processos. Trocar senha revoga
  todas as sessões da conta. Remover ou adulterar cookies não concede permissões.
- Os endpoints leem a função e a liberação ilimitada do banco. As permissões não
  vêm do formulário nem do navegador. Convidados recebem sempre função jogador.
- Concessão/revogação de ilimitado registra ator, conta, ação e horário.

## Tempo de jogo

Ativar no servidor `LABS_ACCOUNTS_ENABLED=true`, `LABS_PLAY_ENABLED=true` e,
no build, `NEXT_PUBLIC_LABS_PLAY_ENABLED=true`. Manter `LABS_ORIGIN` exato e
`LABS_USAGE_SECRET` aleatório, persistente e privado. Conexão MySQL usa as mesmas
variáveis documentadas em GAME-USAGE.md; SMTP tem configuração separada.

O servidor concede 15 minutos/dia a visitantes e 60 minutos/dia a contas.
Dias seguem America/Sao_Paulo. Pausas/abas ocultas não debitam tempo. Cada partida
consulta o servidor ao retomar e a cada 15 segundos; ao perder conexão ou acabar
o saldo, o portal pausa o jogo. A tolerância operacional do heartbeat é de até
15 segundos. Não anunciar controle antifraude absoluto: o código do jogo roda
no navegador e visitantes podem trocar sua identidade.

A permissão ilimitada é independente da função admin. Ela elimina o teto diário;
revogá-la reaplica o teto e considera todo o tempo já usado naquele dia, inclusive
durante o período ilimitado. Mudanças chegam no próximo heartbeat/retomada.
Tempo já debitado como visitante é transportado para a conta sem duplicá-lo em
logins repetidos. Duas abas/dispositivos da mesma conta não debitam simultaneamente.

Este controle usa o cookie necessário `labs_player`, separado da medição opcional.
Não depende da aceitação de analytics. O build de produção redireciona aberturas
diretas dos arquivos do jogo ao portal; o modo Vite de desenvolvimento segue livre.

## Instalação e manutenção

1. Executar `node scripts/setup-accounts.mjs` com as variáveis privadas no ambiente.
2. Provisionar o primeiro admin via `configure-usage-session.mjs`, enviando por
   stdin oculto `{env:{...},accounts:true,play:true,admin:"alexandre"}`.
   A função de bootstrap existe somente nesse script, sem rota pública.
   Se já existe admin, o script interrompe e não troca a senha nem cria outro.
3. Entregar ao dono o link de ativação, sem colocá-lo em commits/documentação.
4. Aplicar flags em build/runtime e agendar diariamente
   `node scripts/cleanup-accounts.mjs` junto à limpeza de métricas.
5. Usar HTTPS, usuário MySQL restrito às tabelas necessárias e proteção do proxy.
   Nunca incluir senha SMTP/MySQL em variáveis NEXT_PUBLIC, comandos ou logs.

Registros temporários de quota cobrem até três dias. Sessões e convites expirados
são removidos pelo script. Contas e histórico de concessões permanecem para gestão;
pedidos de eliminação são tratados pelo responsável antes de abrir cadastro público.

## E-mail Hostinger

Caixa: `contas@labsgames.cloud`; SMTP `smtp.hostinger.com:465` com TLS verificado.
Fonte: https://www.hostinger.com/support/1575756-how-to-get-email-account-configuration-details-for-hostinger-email/
Variáveis: `LABS_SMTP_HOST`, `LABS_SMTP_PORT`, `LABS_SMTP_USER`,
`LABS_SMTP_PASSWORD`, `LABS_MAIL_FROM`.

O arquivo local `.local/mail.env` é privado e ignorado pelo Git. Verificação:
`node scripts/verify-mail.mjs .local/mail.env`. O comando autentica o SMTP sem
enviar mensagem nem imprimir a senha. `lib/server/mail.mjs` fornece envio
transacional, com acesso a arquivos/URLs e logs do transporte desativados.
Na hospedagem, fornecer as variáveis no ambiente do serviço.

## Limites desta etapa

O cadastro público com confirmação de e-mail e a recuperação automática ainda não
estão expostos. As contas funcionam por convite do administrador. Não há coleta de
idade, publicidade comportamental ou campanha para menores. A liberação por um
administrador não substitui os cuidados necessários antes da abertura pública.

O salvamento remoto foi implementado em 1.11.0, com ativação separada e
importação explícita dos saves anteriores. A nuvem é reservada ao benefício
pago ou liberação manual; contas gratuitas continuam com save local. O pagamento
ainda não está integrado. Consulte [WORLDS.md](WORLDS.md).
Multiplayer, pagamentos e versões PC/mobile seguem fora deste piloto.

## Testes

`node --test tests/accounts.test.mjs tests/play-quota.test.mjs tests/game-usage.test.mjs`
valida hashing, ativação única/expirada, papéis, auditoria, ilimitado/revogação,
limites de login, logout/troca de senha, 15/60 minutos, virada do dia, abas e
transporte de tempo visitante. Builds e verificação de UI complementam esses testes.

## Painel administrativo (1.12.0)

Rotas sob `/admin`, todas protegidas pela sessão administrativa e pelo mesmo
layout escuro do portal (`components/admin-shell.tsx`):

| Rota | Conteúdo |
| --- | --- |
| `/admin` | Visão geral: jogando agora, minutos de hoje, contas, gráficos de 7/14 dias, auditoria |
| `/admin/jogadores` | Convites, tempo ilimitado e nuvem por conta, filtro por usuário |
| `/admin/pagamentos` | Reservado; só exibirá eventos confirmados pelo provedor (nenhum valor simulado) |
| `/admin/mundos` | Totais de mundos e espaço, auditoria de liberações de nuvem |
| `/admin/uso` | Medição opcional (consentimento), com gráfico |
| `/admin/configuracoes` | Valores em vigor, somente leitura nesta etapa |

`GET /api/admin/overview` agrega contagens e totais (nunca snapshots, tokens,
IPs ou e-mails). Gráficos usam Recharts, já presente no projeto.

Limites de login revisados: 10 tentativas por conta+cliente (primeiro salto do
`x-forwarded-for`) e 100 por conta em 15 minutos, para que um terceiro não
consiga travar a conta de outra pessoa; orçamento global de 1.000 operações
de senha por 15 minutos. A limpeza de sessões, convites e quotas expiradas
também roda de forma oportunista a cada hora pelo `/api/play`, além do script.

## Cadastro público e recuperação (1.13.0)

Desligado por padrão. Ativar com `LABS_SIGNUP_ENABLED=true` (servidor) e
`NEXT_PUBLIC_LABS_SIGNUP_ENABLED=true` (build). Tabelas: `node scripts/setup-accounts.mjs`
ou `configure-usage-session.mjs` com `{signup:true}`. Exige o SMTP configurado.

Fluxo (`lib/server/signup.mjs`, rotas em `/api/account/*`):
- `register`: usuário, e-mail, senha e data de nascimento. A conta nasce com senha,
  mas só entra após confirmar o link de 24 h enviado por e-mail. A data de nascimento
  **não é armazenada**: fica só a marcação `minor` (menor de 18). Menores de 13 informam
  o e-mail de um responsável, que recebe e confirma o cadastro (`labs_account_emails`).
- `verify` / `resend`: confirmação e reenvio (reenviar invalida links anteriores).
- `recover` / `reset`: redefinição por link de 1 h, apenas para e-mails confirmados.
  Responde sempre OK para não revelar se o e-mail existe. Redefinir encerra sessões.
- Limites por cliente: 5 cadastros e 10 e-mails por 15 minutos, além do orçamento
  global. Origem obrigatória. Tokens guardados só como SHA-256, uso único.
- Contas por convite continuam funcionando sem e-mail.

Páginas: `/conta/criar`, `/conta/verificar`, `/conta/recuperar`, `/conta/redefinir`;
links aparecem no login quando a flag pública está ativa. Em desenvolvimento,
`LABS_MAIL_OUTBOX=.local/outbox` grava as mensagens em arquivo em vez de enviar.

Pendências antes de abrir ao público: revisar Termos e Privacidade (e-mail, menores,
retenção), e definir atendimento a pedidos de exclusão. Menores nunca entram em
remarketing, conforme ECA Digital.

Testes: `node --test tests/signup.test.mjs`.

## Liberação manual de pacotes cosméticos (1.15.0)

`labs_pack_grants` guarda liberações manuais (família, promoções) por conta e pacote;
`PATCH /api/admin/accounts {id, pack, granted}` com auditoria `pack-granted`/`pack-revoked`.
`accounts.entitlements(id)` une liberações manuais e pedidos pagos; é o que `/api/account/me`
expõe e o portal envia ao jogo. Botão "Liberar Expedição" em `/admin/jogadores`.
