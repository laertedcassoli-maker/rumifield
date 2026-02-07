

## Snapshot dos Produtos no Checkout da Visita

### Objetivo
Salvar o estado (stage) de cada produto do cliente no momento em que a visita e finalizada, para que ao reabrir uma visita concluida, os cards de produto mostrem o status historico correto -- nao o status atual.

### O que muda para o usuario
- Ao abrir uma visita concluida, os produtos aparecerao com o status que tinham naquele momento (ex: "Nao Qualificado"), mesmo que hoje estejam em outro estagio.
- Visitas novas continuam funcionando normalmente.

---

### Detalhes tecnicos

#### 1. Nova tabela: `crm_visit_product_snapshots`

Armazena uma copia do estado de cada produto no momento do checkout.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| visit_id | uuid FK -> crm_visits | Visita associada |
| client_product_id | uuid FK -> crm_client_products | Produto original |
| product_code | product_code (enum) | Codigo do produto |
| stage | crm_stage (enum) | Estagio no momento do checkout |
| value_estimated | numeric | Valor estimado na epoca |
| probability | integer | Probabilidade na epoca |
| loss_reason_id | uuid | Motivo de perda, se aplicavel |
| loss_notes | text | Notas de perda |
| created_at | timestamptz | Timestamp do snapshot |

RLS: mesmas regras dos outros dados CRM (admin/coordenador ve tudo, consultor ve os seus).

#### 2. Alteracao no `FinalizarVisitaModal.tsx`

No `mutationFn`, apos atualizar a visita para "concluida", buscar todos os `crm_client_products` do cliente e inserir um registro por produto na tabela `crm_visit_product_snapshots`.

```
// Pseudocodigo dentro do finalizeMutation
const { data: products } = await supabase
  .from('crm_client_products')
  .select('id, product_code, stage, value_estimated, probability, loss_reason_id, loss_notes')
  .eq('client_id', clientId);

const snapshotInserts = products.map(p => ({
  visit_id: visitId,
  client_product_id: p.id,
  product_code: p.product_code,
  stage: p.stage,
  value_estimated: p.value_estimated,
  probability: p.probability,
  loss_reason_id: p.loss_reason_id,
  loss_notes: p.loss_notes,
}));

await supabase.from('crm_visit_product_snapshots').insert(snapshotInserts);
```

#### 3. Alteracao no `CrmVisitaExecucao.tsx`

- Adicionar query para buscar snapshots da visita: `crm_visit_product_snapshots` filtrado por `visit_id`.
- Quando a visita esta concluida (`isCompleted`) e existem snapshots, usar os dados do snapshot (stage, loss_reason_id, loss_notes) ao renderizar os `ProductCard`, em vez dos dados ao vivo do `crm_client_products`.
- Quando nao ha snapshots (visitas antigas, antes desta feature), continuar usando os dados ao vivo como fallback.

#### 4. Nenhuma alteracao no `ProductCard`

O `ProductCard` ja recebe `stage`, `lossReasonId`, `lossNotes` como props -- basta passar os valores do snapshot em vez dos ao vivo.

