# Rastreio Omie passa a gravar (Etapa 2)

## O que muda para o usuário
- O código de rastreio encontrado no Omie é gravado sozinho no pedido, mas só quando o pedido ainda não tem código. Um código que já existe nunca é trocado.
- Ao concluir um pedido Correios, a busca no Omie roda em segundo plano, sem travar a tela e sem mostrar erro.
- A busca em lote roda sozinha 3 vezes ao dia: 8h, 13h e 18h (horário de Brasília).
- Na tela Rastreio Correios entra o botão "Buscar no Omie agora", que mostra o resumo do lote.
- No detalhe do pedido, ao lado do código de rastreio, aparece de onde ele veio: Omie, Relatório Correios ou Manual.

## Etapas
1. **Banco:** novas colunas `codigo_rastreio_origem` (omie / relatorio_correios / manual) e `codigo_rastreio_atualizado_em` em pedidos. Os pedidos atuais não mudam.
2. **Quem mais grava:** a sync-correios-rastreio grava a origem `relatorio_correios` e o ProcessarPendenciaDialog grava `manual`, as duas com a data de agora.
3. **buscar-rastreio-omie, gravação:**
   - Grava só quando o resultado é "encontrado" e existe exatamente um código distinto entre todas as NFs.
   - A gravação usa `update ... where id = pedidoId and codigo_rastreio is null` e confere a linha que voltou.
   - Se duas NFs trouxerem códigos diferentes, nada é gravado e a resposta é `multiplos_codigos`.
   - Com `dryRun: true`, só consulta, sem gravar. O botão atual do detalhe do pedido segue funcionando e mostra se o código foi gravado.
4. **Modo lote (`lote: true`):**
   - Busca pedidos com tipo_logistica 'correios', status faturado ou enviado, sem código de rastreio, com omie_nf_numero preenchido e faturados nos últimos 45 dias.
   - Processa no máximo 25, do mais antigo para o mais novo, reaproveitando o cache e o retry que já existem para evitar "Consumo redundante".
   - Devolve `{ processados, preenchidos, sem_rastreio, nao_encontrados, ambiguos, erros, detalhes[] }`.
5. **Autenticação:** aceita o header `x-sync-secret` com um novo segredo `SYNC_OMIE_RASTREIO_SECRET` (mesmo padrão da sync-correios). Usuários logados continuam sendo aceitos com os papéis de hoje.
6. **Automático:**
   - `handleConcluir` chama a função sem esperar (fire-and-forget) quando o pedido é Correios.
   - O cron chama o lote às 11h, 16h e 21h UTC, via pg_net, com o segredo guardado no Vault. Isso dá 3 execuções por dia.
7. **Telas:**
   - Botão "Buscar no Omie agora" em RelatorioCorreios.tsx, com um cartão de resumo e a lista de detalhes.
   - Selo de origem ao lado do código de rastreio no detalhe do pedido.

## Testes
- SP-00000581: o botão não altera nada, porque o pedido já tem AD948036732BR.
- "Buscar no Omie agora": mostra o resumo. Conferir 2 ou 3 pedidos preenchidos.
- Rodar o lote 2 vezes seguidas: a 2ª execução não preenche nada novo e não dá erro de consumo redundante.
- Consultar `cron.job`: o agendamento aparece em 11h, 16h e 21h UTC.

## Detalhes técnicos
- Os valores de origem são validados por um CHECK simples. Os valores são fixos, então o CHECK é seguro.
- O segredo é gerado e gravado nos secrets da função e também no Vault. O cron é criado por SQL fora das migrações, porque contém a URL e o segredo do projeto.
