

## Ocultar card Motor para atividades sem motor

### Entendimento
- Apenas a atividade "Reparo de pistola" (`559d136b-...`) envolve motor.
- Todas as demais (solenoide, flojet, counter balance, etc.) não devem exibir o card Motor.

### Abordagem
Adicionar um campo `has_motor` (boolean, default false) na tabela `activities`. Setar `true` apenas para "Reparo de pistola". No `DetalheOSDialog`, condicionar a exibição do `MotorSection` a esse flag.

### Alterações

**1. Migração SQL**
- `ALTER TABLE activities ADD COLUMN has_motor boolean NOT NULL DEFAULT false`
- `UPDATE activities SET has_motor = true WHERE id = '559d136b-f589-49b1-b258-3ad0e8eebc9e'`

**2. `DetalheOSDialog.tsx`** (linha ~1080)
- Alterar condição de `{univocaItem?.workshop_item_id && (` para `{univocaItem?.workshop_item_id && workOrder.activities?.has_motor && (`
- Incluir `has_motor` no select da query de work orders

**3. `OrdensServico.tsx`** — incluir `has_motor` no select de activities

**4. `OSKanban.tsx`** — propagar o tipo para incluir `has_motor`

Isso permite que no futuro, ao criar novas atividades, o admin possa marcar se envolve motor ou não.

