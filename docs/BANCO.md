# Banco de dados novo

A plataforma usa MySQL (mysql2) em produção e SQLite em testes e desenvolvimento. O código é o mesmo do portal, então o banco novo começa **vazio** e com o mesmo esquema; nada é migrado automaticamente do banco do LABSGames.

## Criar

1. Crie um banco e um usuário exclusivos no provedor (por exemplo `vale_dos_blocos`), com TLS se for remoto.
2. Preencha `LABS_MYSQL_HOST/PORT/DATABASE/USER/PASSWORD/TLS` e um `LABS_USAGE_SECRET` novo (não reutilize o do portal: ele assina cookies de jogador).
3. Rode:

```powershell
cd web
node scripts/setup-database.mjs
```

Tabelas criadas (todas `labs_*`): accounts, auth_sessions, account_invites, auth_limits, pack_grants, account_audit, cloud_access, account_emails, email_tokens, play_sessions, play_daily, play_guest_claims, play_stats, worlds, orders, payment_events, coupons, coupon_uses, usage_sessions, usage_daily.

4. Crie o primeiro administrador com `scripts/configure-usage-session.mjs` (lê a configuração por stdin oculto; veja `web/docs/ACCOUNTS.md`).

## Migrar jogadores do portal (opcional)

Se quiser levar contas, compras e mundos do LABSGames para cá, as tabelas relevantes são `labs_accounts`, `labs_account_emails`, `labs_cloud_access`, `labs_pack_grants`, `labs_orders`, `labs_worlds` e `labs_play_daily`. Como o esquema é idêntico, um `mysqldump` dessas tabelas funciona. Não copie `labs_auth_sessions` nem `labs_auth_limits` (sessões e limites são por servidor) e **não** reutilize `LABS_USAGE_SECRET`: cookies antigos de visitante deixam de valer (o tempo diário de visitantes recomeça; o das contas é preservado por `labs_play_daily`).

## Rotina

- `scripts/cleanup-accounts.mjs` e `scripts/cleanup-game-usage.mjs`: limpeza de registros expirados; agendar diariamente.
- Backup: `labs_worlds` (até 4 MB por mundo) e `labs_orders` são as tabelas que não podem ser perdidas.
