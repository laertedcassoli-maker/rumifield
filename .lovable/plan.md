

## Exigir Check-in antes de liberar edicao de produtos

### Situacao atual

Hoje os cards de produtos e seus botoes de acao (Qualificar, Criar Proposta, Atualizar Negociacao, Gravar Audio) ficam acessiveis mesmo antes do check-in (status `planejada`). Isso permite que o consultor faca alteracoes no CRM sem estar fisicamente no cliente.

### Alteracao proposta

Bloquear a interacao com os cards de produto quando a visita ainda nao teve check-in. Apenas visitas com status `em_andamento` terao os botoes de acao habilitados.

### Arquivo: `src/pages/crm/CrmVisitaExecucao.tsx`

1. Alterar a prop `readOnly` do `ProductCard` de `isCompleted` para `!isActive` -- isso cobre `planejada`, `concluida` e `cancelada`
2. Adicionar um aviso visual acima da secao de Produtos quando a visita estiver planejada, informando que e necessario fazer check-in primeiro
3. Manter a secao de Propostas e Acoes visiveis (somente leitura) para contexto

### Arquivo: `src/components/crm/ProductCard.tsx`

Nenhuma alteracao necessaria -- o componente ja respeita a prop `readOnly` e esconde os botoes de acao quando `true`.

### Resultado esperado

- Visita `planejada`: cards de produto visiveis (para contexto), mas sem botoes de acao. Aviso: "Faca o check-in para liberar a edicao"
- Visita `em_andamento`: cards com todos os botoes habilitados (comportamento atual)
- Visita `concluida` / `cancelada`: cards em modo somente leitura (comportamento atual)

### Detalhes tecnicos

Na linha onde `readOnly` e passado ao `ProductCard`:

```typescript
// De:
readOnly={isCompleted}

// Para:
readOnly={!isActive}
```

Aviso visual antes dos cards (apenas para `planejada`):

```tsx
{isPlanned && (
  <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
    <MapPin className="h-4 w-4 shrink-0" />
    <span>Faca o check-in para liberar a edicao dos produtos.</span>
  </div>
)}
```

Tambem bloquear o botao "Criar Acao" que hoje aparece na barra de acoes ativas -- ele so deve aparecer quando `isActive`.

