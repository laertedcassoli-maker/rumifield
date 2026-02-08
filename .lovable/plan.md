

## Melhorias na Tela de Visitas CRM

### 1. Status Visual "Atrasada" (sem alterar banco)

Na listagem (`CrmVisitas.tsx`), visitas com status `planejada` cuja `planned_start_at` ja passou serao exibidas com badge "Atrasada" em vermelho, derivado em tempo real. Nao e necessario novo valor no enum do banco -- e apenas visual.

- Adicionar logica: se `status === 'planejada'` e `planned_start_at < agora`, exibir badge "Atrasada" com cor vermelha
- Adicionar contador de atrasadas nos filtros do topo (ao lado de Planejadas/Andamento/Concluidas)

### 2. Botao de Cancelar Visita com Justificativa

Adicionar um botao "Cancelar Visita" na tela de execucao (`CrmVisitaExecucao.tsx`) para visitas nos status `planejada` ou `em_andamento`.

**Banco de dados**: Adicionar coluna `cancellation_reason TEXT` na tabela `crm_visits` para armazenar a justificativa.

**Componente**: Reutilizar o padrao do `CancelarVisitaDialog.tsx` ja existente no modulo preventivo -- um AlertDialog com campo de justificativa obrigatoria.

**Novo arquivo**: `src/components/crm/CancelarVisitaCrmDialog.tsx`
- AlertDialog com titulo "Cancelar Visita"
- Exibicao do nome do cliente
- Textarea obrigatoria para justificativa
- Botoes Voltar / Confirmar Cancelamento

**Na tela de execucao** (`CrmVisitaExecucao.tsx`):
- Botao "Cancelar Visita" visivel apenas para visitas `planejada` ou `em_andamento`
- Mutation que atualiza `status = 'cancelada'` e `cancellation_reason = justificativa`
- Apos cancelar, redirecionar para `/crm/visitas`

### 3. Exibicao da Justificativa

Na tela de execucao, visitas canceladas exibirao um card com a justificativa do cancelamento.

### Resumo de arquivos

| Arquivo | Alteracao |
|---|---|
| `CrmVisitas.tsx` | Badge "Atrasada" visual + contador no filtro |
| `CrmVisitaExecucao.tsx` | Botao cancelar + exibicao de justificativa |
| `CancelarVisitaCrmDialog.tsx` | Novo componente (dialog de cancelamento) |
| Migracao SQL | Adicionar coluna `cancellation_reason` |

### Detalhes tecnicos

**Migracao SQL:**
```sql
ALTER TABLE public.crm_visits ADD COLUMN cancellation_reason TEXT;
```

**Logica de "Atrasada" (derivada, sem novo enum):**
```typescript
const isOverdue = v.status === 'planejada' && v.planned_start_at && new Date(v.planned_start_at) < new Date();
const displayStatus = isOverdue ? 'atrasada' : v.status;
```

**RLS**: Nenhuma mudanca necessaria -- a policy de UPDATE ja permite que o consultor dono do cliente atualize a visita.

