# Estoque Uso/Consumo — Fase 5: consumo na Visita Técnica

## Resposta ao item 1 (confirmado no código)
ConsumedPartsBlock já é **offline-first**: toda peça adicionada é gravada primeiro no aparelho (Dexie, `offlineChecklistDb`) e, com sinal, também direto no banco; sem sinal, vai para a fila de sincronização do checklist (`checklistSyncQueue`), que já envia insert/update/delete por tabela. As saídas novas de estoque entram **nessa mesma fila**.

## Comportamento
1. **Busca de peça com origem "Técnico"**: a lista passa a mostrar peças do catálogo (como hoje, selo "Catálogo") e itens Uso/Consumo puros, sem peça vinculada (selo "Uso/Consumo"). Com origem "Fazenda" ou "Novo pedido", a busca continua igual a hoje.
2. **Peça real + Técnico**: grava a peça como hoje, e o pedido de NF segue igual. Se a peça tiver item correspondente no Estoque Uso/Consumo, grava também uma saída do estoque do técnico. Caso contrário, nada muda.
3. **Item Uso/Consumo puro**: grava só a saída do estoque do técnico. Não grava peça e não gera pedido nem NF.
4. **Quantidade e saldo**: a quantidade precisa ser maior que 0. Quando há item rastreado, a saída não pode passar do saldo do técnico. Sem sinal, o saldo vem de uma cópia guardada no aparelho, descontando as saídas que ainda aguardam envio.
5. **Lista de peças consumidas**: mostra os dois tipos juntos. Os itens Uso/Consumo aparecem com o selo "Uso/Consumo", sem o seletor de origem, e as saídas pendentes mostram "Aguardando envio".
6. **Técnico da saída**: é o técnico da rota (preventiva) ou da visita (corretiva). Quando não for possível identificar, usa quem está logado.

## Decisões que preciso confirmar (os movimentos não podem ser editados nem apagados)
- **Remover um item Uso/Consumo da lista**: proposta é gravar uma entrada de estorno no estoque do técnico, com a mesma origem "visita".
- **Trocar a origem de uma peça real de "Técnico" para outra**, ou removê-la: proposta é gravar o mesmo estorno. **Trocar de outra origem para "Técnico"** depois de adicionada: proposta é gravar a saída nesse momento.
- **Estornos feitos por outra pessoa** (ex.: admin removendo um item do técnico): pelas regras atuais, esse estorno exige a permissão "Criar item/Dar entrada". O técnico, no próprio estoque, só precisa de "Dar saída". Não proponho mudar regras.
- **Instalação**: proponho deixar para depois. Ela usa outro componente (ChecklistExecution) com outra fila no aparelho e outra tabela de consumo, então seria um trabalho separado.

## O que não muda
preventive_part_consumption (incluindo part_id obrigatório), geração de pedido/NF em ExecucaoVisitaCorretiva.tsx, origens "Fazenda" e "Novo pedido", regras e permissões do banco. Nada é publicado.

## Detalhes técnicos
- Sem migração. Movimentos usam `origem_tipo='visita'` e `origem_id=preventiveId`; os estornos usam tipo `entrada` com nota "Estorno".
- Dexie (nova versão de `offlineChecklistDb`): tabela `estoqueConsumoItens` (cache do catálogo), `estoqueSaldoTecnico` (cache do saldo) e `estoqueMovimentosLocais` (lançamentos da visita, com `_pendingSync`). A fila ganha a tabela `estoque_consumo_movimentos` (só `insert`, com id gerado no aparelho para a operação poder ser repetida sem duplicar).
- Online: grava direto com `.select('id')` e timeout de 12s; offline: grava no aparelho e entra na fila.
- A consulta da lista junta `preventive_part_consumption` e `estoque_consumo_movimentos` (somando saídas menos estornos por item, para esta visita) com as pendências guardadas no aparelho.
- O vínculo peça→item é feito pelo cache: `estoque_consumo_itens.peca_id = part_id`, só itens ativos.
- Arquivos: ConsumedPartsBlock.tsx, offline-checklist-db.ts e o processador da fila (só o novo tipo de tabela). ExecucaoVisitaCorretiva.tsx e AtendimentoPreventivo.tsx não mudam; se o técnico da visita precisar vir deles, adiciono uma propriedade opcional ao componente, sem mexer em outra lógica.
