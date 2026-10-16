# Pagamentos — Mercado Pago (1.14.0)

Desligado por padrão. Benefício só é concedido depois que o servidor consulta o
pagamento na API do Mercado Pago; webhook, tela de retorno e navegador não concedem nada.

## Produtos

`lib/products.mjs`: `vale-completo` (R$ 29,90: tempo ilimitado + nuvem) e
`vale-nuvem` (R$ 9,90: só nuvem). Preços são hipóteses do piloto; o valor cobrado
é sempre o do servidor, nunca o enviado pelo navegador.

## Fluxo

1. `POST /api/checkout {product}` (logado, origem verificada): cria pedido `pending`
   em `labs_orders` e uma preferência do Checkout Pro com `external_reference` =
   id do pedido, `notification_url` = `/api/payments/webhook` e retorno para `/conta?pedido=`.
   Responde `url` (init_point) para redirecionar. Máximo de 3 pedidos pendentes por hora.
2. Mercado Pago chama `POST /api/payments/webhook?data.id=...&type=payment`.
   O servidor valida `x-signature` (manifesto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`,
   HMAC-SHA256 com `LABS_MP_WEBHOOK_SECRET`, janela de 15 min), registra o evento em
   `labs_payment_events` (idempotente) e **consulta `GET /v1/payments/{id}`** com o token.
3. Se `status=approved`, valor e moeda conferem com o pedido, concede os benefícios
   (`labs_accounts.unlimited`, `labs_cloud_access`) com auditoria `system:payment`.
   `refunded`/`charged_back` revogam. Valor divergente é ignorado e marcado no pedido.
4. `/conta` mostra produtos, "Comprar" e "Meus pedidos"; ao voltar do checkout com
   `?pedido=`, o servidor reconsulta pedidos pendentes. `/admin/pagamentos` mostra
   receita do mês, pagos, reembolsos, por produto e os últimos 100 pedidos.

## Ativação

1. Criar aplicação em https://www.mercadopago.com.br/developers (Checkout Pro),
   obter **Access Token de produção** e configurar o webhook para
   `https://labsgames.cloud/api/payments/webhook` (evento Pagamentos), copiando a
   **assinatura secreta**.
2. Variáveis no servidor: `LABS_PAYMENTS_ENABLED=true`, `LABS_MP_ACCESS_TOKEN`,
   `LABS_MP_WEBHOOK_SECRET`; no build: `NEXT_PUBLIC_LABS_PAYMENTS_ENABLED=true`.
3. Tabelas: `node scripts/setup-accounts.mjs` ou `configure-usage-session.mjs` com `{payments:true}`.
4. Testar primeiro com credenciais de teste do Mercado Pago e um usuário de teste
   comprador; verificar no painel que o pedido ficou "Pago" e a conta recebeu a nuvem.

Nunca colocar o access token em `NEXT_PUBLIC_`, commits ou logs. Erros do provedor
são registrados só como código (`MP_401`, `MP_404`...). Testes: `node --test tests/payments.test.mjs`.

## Pacotes cosméticos (1.15.0)

`vale-aparencias-expedicao` (R$ 9,90) concede `outfits:expedicao`. A posse é derivada de
pedidos `approved` (`payments.entitlements`), exposta em `GET /api/account/me` como
`account.entitlements.outfits` e enviada ao jogo no `start`. Reembolso remove o pacote.
O jogo pede a compra com `purchase-request`; o portal abre o checkout (`/api/checkout`).
Comprar de novo um pacote já pago é recusado (409).

## Cupons de desconto

- Criados só por administradores em `/admin/pagamentos` (ou `POST /api/admin/coupons`): código
  (3 a 32 letras, números ou hífen, sempre em maiúsculas), desconto em %, produto opcional,
  quantidade de usos e validade. `PATCH` desliga ou religa um cupom. Tudo fica na auditoria.
- O jogador digita o código na loja (página do jogo ou `/conta`) e o servidor calcula o valor:
  o pedido guarda o valor com desconto e o Mercado Pago recebe esse valor; a conciliação
  continua exigindo que o valor pago seja exatamente o do pedido.
- Cupom de 100% aprova o pedido na hora, sem passar pelo provedor (`provider = coupon`),
  e aplica os benefícios. Webhooks para esses pedidos são ignorados.
- Tentativas de cupom são limitadas a 20 por conta a cada 15 minutos; cupom inválido não cria pedido.
- Tabelas: `labs_coupons` e `labs_coupon_uses` (criadas por `PAYMENT_SCHEMA`, sem ALTER).

## Checkout em uma página e compra só com e-mail

- `/comprar/<produto>` concentra tudo: produto, cupom, pagamento. Loja, aviso de fim de tempo
  e o próprio jogo (`purchase-request`) levam para lá.
- Sem sessão, o comprador informa só o e-mail (`POST /api/checkout` com `email`). O servidor
  encontra a conta sem senha daquele e-mail ou cria uma (usuário derivado do e-mail, sem senha) e abre o
  pedido. Nenhuma mensagem é enviada antes do pagamento.
- Quando o pagamento é confirmado (webhook ou cupom de 100%), a conta sem senha recebe um
  convite de 7 dias por e-mail (`/conta/ativar#token=`); contas com senha recebem um recibo.
  O e-mail é marcado como verificado nesse momento, pois só quem o recebe consegue ativar.
- Limites: 5 tentativas por e-mail e 20 por IP a cada 15 minutos, além do limite por
  requisição. E-mails inválidos não criam conta.
- Tabelas de contas, e-mails e pagamentos são criadas sob demanda em `getPayments`.

## Regras de segurança (auditoria)

- Compra só com e-mail: se o e-mail já pertence a uma conta **com senha**, o checkout responde 409
  ("Esse e-mail já tem conta. Entre na sua conta para comprar."). Conta sem senha já existente
  recebe o pedido, mas **sem** cookie `labs_claim`: só o convite enviado por e-mail ativa a conta.
- O cookie `labs_claim` só é emitido quando o próprio checkout criou a conta; o pedido guarda
  `labs_orders.claimable = 1` e `claimOrder` exige isso dentro da transação.
- A resposta do checkout e o `/api/checkout/status` não revelam `created`/`username`; o usuário só
  aparece para o dono logado ou para o navegador que criou a conta naquele pedido.
- Pedido substituído (`superseded`) mantém o uso do cupom consumido; se a preferência antiga for
  paga, o pedido é aprovado sem ultrapassar `max_uses`. Outros cancelados nunca são aprovados.
- Estados: `pending`/`rejected` → `approved|rejected|cancelled|pending`; `approved` → `refunded`
  só por reembolso/chargeback do **mesmo** `payment_id`; `refunded` é final.
- Evento do webhook só é gravado em `labs_payment_events` depois que `GET /v1/payments` responde;
  falha do provedor deixa o reenvio ser processado. A assinatura é verificada antes do limite de
  requisições, que só conta chamadas com assinatura inválida.
- Reembolso não revoga ilimitado/nuvem que outro pedido aprovado ou concessão manual (admin)
  ainda mantém; pacotes cosméticos já são derivados de pedidos aprovados + `labs_pack_grants`.
- Migração: coluna `labs_orders.claimable` criada por `migratePayments` (ALTER idempotente que
  ignora "duplicate column" no MySQL e no SQLite), chamada em `getPayments`.
