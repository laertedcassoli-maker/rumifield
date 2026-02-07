

## Problema

Ao abrir uma visita concluida, a tela nao mostra adequadamente o que foi realizado. Especificamente:

1. **Resumo** -- ja aparece, mas pode ficar mais destacado visualmente
2. **Propostas geradas** -- os dados sao carregados (`proposals` do hook) mas nunca sao exibidos na tela
3. **Acoes** -- mostra todas as acoes do cliente, sem destaque para as criadas durante a visita
4. **Duracao da visita** -- check-in e check-out existem mas nao mostram a duracao total

## Solucao

Melhorar a tela de execucao para visitas concluidas, adicionando secoes informativas:

### 1. Destacar o resumo visualmente
- Quando a visita esta concluida e tem `summary`, exibir em um card com fundo verde claro e icone de check, para ficar claro que e o resultado da visita.

### 2. Adicionar secao de Propostas
- Exibir as propostas do cliente (`proposals` ja carregadas pelo hook) em cards mostrando: produto, valor proposto, status, data de envio e validade.
- Filtrar para mostrar apenas propostas relevantes (criadas no periodo da visita ou todas do cliente, conforme disponivel).

### 3. Mostrar duracao da visita
- Quando ha check-in e check-out, calcular e exibir a duracao total (ex: "1h 23min").

### 4. Melhorar layout para visitas concluidas
- Reorganizar as secoes para que visitas concluidas priorizem: Resumo, Propostas, Acoes, Checklists, Produtos.
- Remover botoes de acao (check-in/finalizar) que ja nao se aplicam (ja e feito, mas garantir).

## Detalhes tecnicos

**Arquivo**: `src/pages/crm/CrmVisitaExecucao.tsx`

Alteracoes:

1. Adicionar calculo de duracao entre `checkin_at` e `checkout_at` usando `date-fns` (ex: `differenceInMinutes`)
2. Quando `isCompleted`, renderizar o resumo em card destacado (bg-green-50, icone CheckCircle2)
3. Adicionar nova secao "Propostas" iterando sobre `proposals` (ja disponivel no hook) com cards mostrando:
   - Produto (via join com `crm_client_products.product_code`)
   - `proposed_value` formatado como moeda
   - `status` (enviada, aceita, recusada)
   - `sent_at` e `valid_until`
4. Importar `differenceInMinutes` de `date-fns`
5. Exibir duracao no card de informacoes da visita ao lado do check-out

