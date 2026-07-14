# Corrigir análise de Oficina no módulo Inteligência

A IA está respondendo com lacunas ("não disponível") e possíveis divergências de número porque a edge function `client-intelligence` (escopo `oficina`) não entrega alguns cortes importantes e usa limiares diferentes do dashboard. Vou ajustar apenas essa edge function.

## Problemas observados na resposta atual

1. **"Motores trocados em Reparo de Pistolas: não disponível"** — hoje `motor_replacement_history` é enviado só como lista das últimas 10 trocas, sem agregação por atividade. Não há como a IA responder por atividade.
2. **"Retrabalho não disponível"** — o cálculo depende de `work_order_items.workshop_item_id`. OS do tipo LOTE (ex.: Reparo de pistola) não têm `workshop_item_id`, então caem fora. O bloco de retrabalho fica vazio e não é enviado.
3. **"Não há motores em estado crítico"** — a edge usa >800h/>1000h, mas o dashboard `SaudeAtivosMotores` usa **>1000h (laranja) / >1500h (vermelho)**. Preciso alinhar.
4. **Divergência de totais de peças** (usuário citou 43 vs 54/61) — os números do bloco `## Peças mais consumidas` refletem apenas o período filtrado, mas isso não fica explícito no cabeçalho de cada seção. A IA acaba omitindo o recorte no texto.

## Edições — `supabase/functions/client-intelligence/index.ts` (escopo `oficina` apenas)

1. **Agregar trocas de motor por atividade**
   - Ampliar o `select` de `motor_replacement_history` para incluir `work_order_id`.
   - Buscar as `work_orders` referenciadas (`id, activity_id, created_at, activities(name)`) num único `.in('id', workOrderIds)` já respeitando o filtro de período/atividade quando informado (mas sempre trazendo total geral também).
   - Adicionar em `stats`: `trocas_motor_por_atividade: [{ atividade, total, ultimos_meses: {mm/yyyy: n} }]` e no `fullContext` uma seção `## Trocas de motor por atividade` com total no período filtrado + últimos 6 meses agregados.

2. **Retrabalho tolerante a LOTE**
   - Manter o cálculo atual `(workshop_item_id + omie_product_id)` para UNIVOCA.
   - Adicionar cálculo paralelo para LOTE: chave `(activity_id + omie_product_id)` restrita a OS sem `workshop_item_id`, mesma janela ≤90 dias, contando repetições da mesma peça na mesma atividade.
   - Anexar como bloco separado `## Retrabalho por atividade (LOTE) — top 15` no `fullContext` (rotular "atividade" em vez de "ativo"), e em `stats.retrabalho_lote_top`.

3. **Alinhar limiares de saúde de motor com o dashboard**
   - Trocar limiares para `> 1500 → critico`, `> 1000 → atencao`, resto `ok`.
   - Atualizar rótulos no `fullContext` (`Críticos (>1500h)`, `Atenção (>1000h)`).

4. **Deixar o recorte de período explícito nos totais**
   - Prefixar as seções `## Peças mais consumidas na oficina`, `## Por Atividade`, `## Trocas de motor por atividade` com o período efetivo (`periodo` já calculado). Ex.: `## Peças mais consumidas na oficina (período: {periodo})`.
   - Reforçar no `systemPrompt` do escopo oficina: quando citar totais, informar sempre o período/filtro correspondente à seção da qual o número foi lido.

5. **Prompt: reforçar honestidade nos totais**
   - Adicionar regra: "Se a pergunta pedir um recorte (por atividade, por mês, etc.) e o dado agregado não estiver presente, diga 'não disponível nos dados enviados' — nunca invente."
   - Manter `temperature: 0`.

## Frontend

Sem alteração. A UI já envia `filters.dateFrom/dateTo/activityIds` corretamente e exibe `stats` genericamente.

## Fora de escopo

- Não mexer em RLS, schema, permissões ou outros arquivos.
- Não alterar os escopos `client`/`all`.
