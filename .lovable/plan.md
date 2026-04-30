## Problema confirmado

Na visita **PREV-2026-00005 > FELIPE DUBEUX DE MIRANDA**:

- O template tem peça vinculada corretamente: **Pistola 1** e **Pistola 2** → não conformidade "Rolamento travado" → peça `PRD00602 - ROLAMENTO DA TAMPA DA ESCOVA`.
- Na execução, ambas pistolas estão com NC "Rolamento travado" + ação "Troca peça" selecionadas.
- Mas em `preventive_part_consumption` **não existe nenhum registro vinculado** a essas execuções (`exec_item_id` / `exec_nonconformity_id` estão NULL).
- Existe apenas um lançamento manual solto da peça (qty=12), sem vínculo com pistola.
- Por isso a validação na finalização vê "5 ações de Troca peça" e só "4 peças manuais", e bloqueia.

## Plano

### 1. Corrigir os dados desta visita (migration)

Para cada uma das 2 pistolas (Pistola 1 e Pistola 2), inserir em `preventive_part_consumption` o consumo automático da peça `PRD00602` quantidade 1, vinculado ao `exec_item_id` e `exec_nonconformity_id` correspondentes.

Remover o lançamento manual solto duplicado da mesma peça (consumo `7bb4fa20-fc65-4ecc-9b96-eb281ed45418`, qty=12), já que as pistolas só pedem 1 unidade cada — total real = 2.

> Se você prefere manter as 12 unidades manuais (caso o técnico realmente tenha trocado mais), me avise antes da execução. Por padrão vou substituir pelos 2 vínculos automáticos corretos.

### 2. Corrigir a lógica de auto-vinculação de peças (`ChecklistExecution.tsx`)

Quando o usuário seleciona uma NC que tem peça mapeada no template **e** seleciona ação "Troca peça", o sistema deve criar automaticamente o registro em `preventive_part_consumption` ligado ao `exec_item_id` + `exec_nonconformity_id`. Hoje esse vínculo automático está falhando para algumas combinações, deixando o item órfão e exigindo lançamento manual.

### 3. Corrigir a validação de finalização (`AtendimentoPreventivo.tsx`)

Substituir a contagem genérica ("X ações Troca peça vs Y peças manuais") por verificação por item:
- Para cada item com ação "Troca peça", verificar se existe consumo (automático OU manual da mesma peça) vinculado àquele `exec_item_id`.
- Se faltar, mostrar exatamente **qual item** está sem peça (ex.: "Falta peça em: Pistola 1").

### 4. Alinhar badge visual (`ChecklistExecution.tsx`)

Garantir que o badge "Peça pendente" use o mesmo critério da validação de finalização, evitando estados contraditórios na tela.

## Arquivos afetados

- Nova migration SQL (corrige dados desta visita).
- `src/components/preventivas/ChecklistExecution.tsx` (auto-vinculação + badge).
- `src/pages/preventivas/AtendimentoPreventivo.tsx` (validação por item com mensagem específica).

## Resultado esperado

- A visita PREV-2026-00005 deixa de bloquear na finalização.
- Em futuras visitas, ao escolher NC + Troca peça, a peça do template é vinculada sozinha.
- Se algum item ficar sem peça, a mensagem dirá exatamente qual item resolver.
