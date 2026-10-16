# Mundos remotos — piloto 1.11.0

## Regra de acesso

| Jogador | Tempo diário | Mundo |
| --- | --- | --- |
| Visitante | 15 minutos | Somente no navegador |
| Conta gratuita, sem benefício de nuvem | 60 minutos | Somente no navegador |
| Conta com nuvem liberada | Conforme permissão de tempo | Um mundo remoto, até 4 MB |

A nuvem está reservada ao benefício pago ou à liberação manual do administrador.
O pagamento ainda não está integrado: hoje somente `/admin` libera ou revoga a
permissão. Não há cobrança, checkout ou comprovação automática de compra.
Ser administrador ou ter tempo ilimitado não libera a nuvem automaticamente.

`labs_cloud_access` guarda a liberação manual, e `labs_account_audit` registra
ator, conta, ação e horário. O servidor verifica a permissão atual em toda
leitura/gravação. Campos enviados pelo jogador não concedem acesso. A futura
integração de pagamentos deve validar o evento no servidor antes de conceder o
benefício; não deve confiar em tela de sucesso ou parâmetros do navegador.

## Armazenamento e recuperação

- `labs_worlds` guarda apenas mundos de contas habilitadas, sem criar linhas
  vazias durante leitura. Visitantes e contas gratuitas não enviam o conteúdo
  dos mundos ao banco; continuam usando o salvamento local existente.
- O portal concentra HTTP/autenticação. O jogo só envia mensagens SDK.
- Falha ao carregar o mundo remoto impede a abertura, sem criar um mundo vazio.
- Uma conta habilitada e ainda sem mundo pode importar o save local por clique.
  A origem é preservada e um mundo remoto existente não é sobrescrito.
- Criar outro mundo exige confirmação. O piloto guarda um mundo atual, sem
  catálogo de vários mundos nem histórico de versões.
- Saves automáticos a cada 30 segundos de jogo, além de Salvar agora/Salvar e
  sair. Fechar à força pode perder o progresso desde a última confirmação.
- Revisões evitam sobrescritas por abas antigas. Tentativas com resposta perdida
  repetem a mesma operação sem duplicar a gravação. Trocar de conta impede
  gravar o mundo carregado na conta errada.
- Cada aba mantém sua cópia pendente separadamente. Falhas pausam a partida e
  oferecem baixar JSON. Ao reabrir, a cópia pendente mais recente pode ser
  retomada se a revisão remota não mudou. Em conflito, fica para download;
  ainda não há mesclagem nem reimportação de arquivos JSON na interface.
- Revogar nuvem bloqueia novas leituras/gravações e mantém o mundo remoto
  existente. Uma partida remota já aberta pausa na próxima tentativa de save,
  preservando a cópia local. Não a converte automaticamente em save visitante.
- Após conceder o benefício, reabrir o jogo carrega a nuvem e oferece importação
  do mundo local quando o espaço remoto estiver vazio.

## Ativação

1. `node scripts/setup-accounts.mjs` prepara contas e permissões.
2. `node scripts/setup-worlds.mjs` prepara a tabela de mundos.
3. Servidor: `LABS_ACCOUNTS_ENABLED=true`, `LABS_PLAY_ENABLED=true`,
   `LABS_WORLDS_ENABLED=true` e as variáveis privadas do MySQL.
4. Build: `NEXT_PUBLIC_LABS_PLAY_ENABLED=true` e
   `NEXT_PUBLIC_LABS_WORLDS_ENABLED=true`.
5. `LABS_ORIGIN` exato, HTTPS na publicação, `LABS_USAGE_SECRET` privado,
   persistente e igual em todos os processos. O helper local gera uma chave de
   desenvolvimento ignorada pelo Git em `.local/player-signing.key`.
6. Em `/admin`, usar Liberar nuvem / Revogar nuvem por conta, independentemente
   do botão de tempo ilimitado.

Mundos não dependem de analytics e não alimentam remarketing. Não há limpeza
ou exclusão automática de mundos nesta etapa. Monitorar espaço e manter os
backups existentes do banco; pedidos de eliminação precisam de tratamento pelo
responsável. O limite de 4 MB também vale para contas com tempo ilimitado.
O estado enviado pelo cliente não é autoridade para saldos, compras, ranking
competitivo ou multiplayer.

## Verificação e publicação

`node --test tests/worlds.test.mjs tests/accounts.test.mjs` e, no jogo,
`node --test tests/remote-save.test.js tests/systems.test.js` verificam permissões,
revogação, isolamento, conflitos, falhas de rede e preservação do legado.

O helper aceita `verifyWorlds:true` para testar a API contra o MySQL local.
Cria contas temporárias de jogador, valida os bloqueios e remove somente suas
próprias contas, sessões, permissões e mundos ao terminar.

Publicar ainda exige variáveis privadas na Hostinger, flags no build, jobs de
limpeza de sessões/métricas e verificação de login/save em HTTPS.
