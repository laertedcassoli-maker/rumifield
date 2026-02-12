
## Simplificar Etapas do CRM e Redesenhar Pipeline

### Resumo
1. Reduzir as etapas de oportunidade para 4 colunas no pipeline: **Nao Qualificado**, **Qualificado**, **Em Negociacao**, **Ganho**, **Perdido**
2. Unificar "proposta" e "negociacao" em "em_negociacao"
3. Remover "descartado" (sem dados existentes)
4. Redesenhar cards do pipeline para mostrar a **oportunidade** (produto + cliente) em vez de apenas o cliente

### Dados existentes a migrar
- 2 registros em "proposta" e 4 em "negociacao" serao migrados para "em_negociacao"
- 0 registros em "descartado" (sem impacto)

---

### Detalhes Tecnicos

**1. Migracao SQL**
- Adicionar valor `em_negociacao` ao enum `crm_stage`
- Migrar dados: `proposta` e `negociacao` para `em_negociacao` nas tabelas `crm_client_products` e `crm_visit_product_snapshots`
- Remover valores antigos `proposta`, `negociacao` e `descartado` do enum

**2. Atualizar tipos e constantes (`src/hooks/useCrmData.ts`)**
- `CrmStage`: remover `proposta`, `negociacao`, `descartado`; adicionar `em_negociacao`
- `STAGE_LABELS`: atualizar para 5 etapas
- `STAGE_COLORS`: atualizar para 5 etapas

**3. Atualizar ProductCard (`src/components/crm/ProductCard.tsx`)**
- Remover cases de `proposta`, `negociacao`, `descartado`
- `qualificado`: CTA passa a ser "Iniciar Negociacao" (abre modal proposta integrado ou vai direto para em_negociacao)
- `em_negociacao`: CTA "Atualizar" (ganho/perdido)
- `perdido`: CTA "Reabrir"

**4. Atualizar AtualizarNegociacaoModal**
- Simplificar opcoes de transicao:
  - `qualificado` -> `em_negociacao`
  - `em_negociacao` -> `ganho` ou `perdido`
  - `perdido` -> `nao_qualificado` (reabrir)

**5. Atualizar CriarPropostaModal**
- Ao criar proposta, o stage passa a ser `em_negociacao` (em vez de `proposta`)

**6. Redesenhar CrmPipeline (`src/pages/crm/CrmPipeline.tsx`)**
- `PIPELINE_STAGES` = `['nao_qualificado', 'qualificado', 'em_negociacao', 'ganho', 'perdido']`
- Grid de 5 colunas em vez de 6
- Cards agora mostram:
  - ProductBadge do produto (ex: RumiFlow, Ideagri)
  - Nome do cliente abaixo
  - Valor estimado (se houver)
  - Cidade
- Remover filtro de produto (pois agora todos os produtos aparecem como cards individuais)
- Manter filtro de consultor para admins

**7. Atualizar CrmVisitaExecucao e CrmCliente360**
- Remover referencias a `proposta`, `negociacao`, `descartado`
- Ajustar logica de modais

**Arquivos a modificar:**
- `src/hooks/useCrmData.ts` - tipos e constantes
- `src/components/crm/ProductCard.tsx` - CTAs
- `src/components/crm/AtualizarNegociacaoModal.tsx` - opcoes de transicao
- `src/components/crm/CriarPropostaModal.tsx` - stage target
- `src/pages/crm/CrmPipeline.tsx` - layout e cards
- `src/pages/crm/CrmCliente360.tsx` - ajustes menores
- `src/pages/crm/CrmVisitaExecucao.tsx` - ajustes menores
