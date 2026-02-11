

## Melhorar visual do botao de cancelar visita

### O que muda

O botao de cancelar aparece em dois estados da visita: **Planejada** e **Em Andamento**. Atualmente ele esta discreto demais e inconsistente entre os dois estados. A melhoria vai tornar o botao mais claro e visualmente coerente.

### Mudancas visuais

**Estado "Planejada" (linha 283-285):**
- Trocar de `variant="outline"` para `variant="outline"` com bordas e texto em vermelho sutil (`border-destructive/40 text-destructive hover:bg-destructive/10`)
- Manter texto "Cancelar" e icone XCircle

**Estado "Em Andamento" (linha 297-299):**
- Trocar de `variant="ghost"` (so icone) para `variant="outline"` com estilo destrutivo sutil (`border-destructive/40 text-destructive hover:bg-destructive/10`)
- Adicionar texto "Cancelar" ao lado do icone para ficar mais claro
- Manter `shrink-0` para nao comprimir

Ambos os botoes ficam com aparencia identica: borda vermelha suave, texto vermelho, e hover com fundo vermelho leve. Visualmente distintos dos botoes de acao principal sem serem agressivos.

### Detalhe Tecnico

**Arquivo:** `src/pages/crm/CrmVisitaExecucao.tsx`

Linha 283-285 (estado planejada):
```tsx
// Antes
<Button size="lg" variant="outline" className="shrink-0 gap-1" onClick={() => setCancelOpen(true)}>
  <XCircle className="h-5 w-5" /> Cancelar
</Button>

// Depois
<Button size="lg" variant="outline" className="shrink-0 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setCancelOpen(true)}>
  <XCircle className="h-4 w-4" /> Cancelar
</Button>
```

Linha 297-299 (estado em andamento):
```tsx
// Antes
<Button size="lg" variant="ghost" className="shrink-0 text-destructive" onClick={() => setCancelOpen(true)}>
  <XCircle className="h-5 w-5" />
</Button>

// Depois
<Button size="lg" variant="outline" className="shrink-0 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setCancelOpen(true)}>
  <XCircle className="h-4 w-4" /> Cancelar
</Button>
```

Uma unica alteracao em cada bloco de botoes.

