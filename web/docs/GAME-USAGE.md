# Medição do Vale dos Blocos — fase 1

Atualização 1.10.0: o acesso ao painel passou a usar a conta administrativa.
As instruções atuais de login, convites e quotas estão em [ACCOUNTS.md](ACCOUNTS.md).
A antiga LABS_USAGE_ADMIN_KEY foi removida; não configurar ou distribuir essa chave.

Implementação local de contador e painel `/admin/uso`, disponível somente quando
as flags abaixo estiverem ativas. Nenhum deploy é feito por estes scripts.
O painel requer uma sessão de administrador válida.

## O que mede

- Somente navegadores que autorizam métricas; não são pessoas únicas nem o público total.
- Partida realmente iniciada, excluindo menu inicial, pausas e abas ocultas.
- Presença com validade de 45 segundos, sessões e minutos por dia (São Paulo).
- Duas abas com o mesmo cookie não somam tempo simultaneamente.
- Dados pseudônimos conservados por 30 dias; o relatório cobre hoje e os 29 dias anteriores.
- Novo consentimento `labs-privacy-v2`, sem reaproveitar a autorização anterior.

Não coleta idade, e-mail, IP, impressão digital ou saves. Não há remarketing.
Logs operacionais da hospedagem são independentes dessas tabelas.
O endpoint é público: cookies novos e clientes automatizados podem influenciar os
números. Eles servem à avaliação do piloto, não a faturamento ou antifraude.

## Configuração no servidor

Fornecer pelo ambiente do serviço (nunca por `NEXT_PUBLIC_` ou Git):

| Variável | Valor |
| --- | --- |
| LABS_USAGE_ENABLED | true |
| NEXT_PUBLIC_LABS_USAGE_ENABLED | true, também durante o build |
| LABS_ORIGIN | https://labsgames.cloud, sem barra final |
| LABS_MYSQL_HOST / LABS_MYSQL_PORT | host / 3306 |
| LABS_MYSQL_DATABASE / LABS_MYSQL_USER / LABS_MYSQL_PASSWORD | credenciais do banco exclusivo |
| LABS_MYSQL_TLS | true para conexão remota, com certificado verificado |
| LABS_USAGE_SECRET | segredo aleatório de pelo menos 32 caracteres |

1. `node scripts/setup-game-usage.mjs` cria apenas `labs_usage_sessions` e `labs_usage_daily`.
2. Fazer build com a flag pública e iniciar o serviço com as variáveis privadas.
3. Agendar `node scripts/cleanup-game-usage.mjs` diariamente, com o mesmo ambiente.
   Também há limpeza oportunista por hora ao registrar ou consultar métricas.
4. Entrar em `/conta/entrar` com uma conta administrativa e abrir `/admin/uso`.

Usar usuário MySQL de execução restrito às duas tabelas (SELECT/INSERT/UPDATE/DELETE),
separado da credencial de migração. Restringir acesso remoto ao IP do aplicativo e
rotacionar a senha compartilhada na conversa. Limitar `/api/game-usage` no proxy
(há limite adicional por processo: 30 eventos/min/navegador e 2.000/min no total).
Usar HTTPS; não remover a validação TLS para contornar erro de conexão.
Backups precisam acompanhar a política de retenção.

`scripts/configure-usage-session.mjs` permite verificar/migrar com JSON por stdin
oculto, sem gravar credenciais. Aceita `{env:{...},migrate:true,devPort:5174}`.
Não colar segredos em argumentos de shell.

## Validação local

`node --test tests/game-usage.test.mjs` testa política, relógio, concorrência,
persistência, retenção, cookies, consentimento e limites. SQLite é apenas um
adaptador de teste/preview, explicitamente bloqueado em produção.
Para preview, configurar `LABS_USAGE_SQLITE_PATH` para `.local/usage-preview.sqlite`,
aplicar o schema e fornecer origem local/segredos de teste no ambiente.

## Próximas entregas já acordadas

Cadastro e recuperação de conta; migração da identidade visitante para conta;
quota diária **15 minutos visitante / 60 minutos cadastrado** controlada no servidor;
mundos remotos com autorização por proprietário e conflitos de revisão.
Os valores estão em `lib/usage-policy.mjs` e foram integrados em 1.10.0; veja ACCOUNTS.md para flags e limites do piloto. O salvamento remoto 1.11.0 está documentado em WORLDS.md.
Excluir cookie perderá a chave do visitante, sem apagar o mundo remoto; uma conta
permitirá recuperar acesso. Não prometer identificação infalível de visitantes.
Quota necessária ao serviço deve funcionar independentemente do consentimento de
métricas opcionais, com finalidade e retenção próprias.

Versão paga PC/mobile deve ficar em diretório/projeto separado. Multiplayer,
pagamentos, economia e campanhas não estão incluídos nesta entrega.

## Extensão do contrato iframe

Vale dos Blocos 1.9.2 emite `{labs:1,type:'gameplay',active:boolean}` apenas após
início real e nas pausas/retomadas/descarte. O portal valida origem e janela do
iframe. `started` continua como handshake e não representa mais tempo jogado.
