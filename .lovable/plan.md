

## Correcao do overflow mobile - causa raiz no AppLayout

### Problema

A pagina de visita CRM continua cortando conteudo na lateral direita em mobile (390px):
- Nome do cliente nao trunca (sem ellipsis)
- Badge "Concluida" fica invisivel
- Texto de acoes cortado

### Causa Raiz

O problema NAO esta na pagina `CrmVisitaExecucao.tsx`. A cadeia de constraints CSS esta quebrada no `AppLayout.tsx`:

```text
SidebarProvider (flex container)
  -> AppSidebar
  -> SidebarInset (flex-1, SEM min-w-0)  <-- QUEBRA AQUI
    -> main (flex-1, overflow-x-hidden)  <-- tambem falta min-w-0
      -> div (w-full, overflow-x-hidden)
        -> CrmVisitaExecucao (min-w-0, overflow-hidden)
          -> header flex (truncate nao funciona)
```

`SidebarInset` usa `flex-1` mas sem `min-w-0`. Em flexbox, `flex-1` respeita a largura minima do conteudo. Sem `min-w-0`, o conteudo pode empurrar o elemento alem do viewport. Isso impede que `truncate` funcione em qualquer descendente, porque nenhum ancestral tem uma largura determinada e restrita.

### Solucao

**Arquivo: `src/components/layout/AppLayout.tsx`**

1. **SidebarInset** (linha 131): Adicionar `min-w-0` ao className

```
Antes:  <SidebarInset className={showBanner ? "pt-10" : ""}>
Depois: <SidebarInset className={cn(showBanner ? "pt-10" : "", "min-w-0")}>
```

2. **main interno** (linha 146): Adicionar `min-w-0`

```
Antes:  <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 max-w-full">
Depois: <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-4 md:p-6 max-w-full">
```

3. **CrmVisitaExecucao.tsx** (linha 225): Remover `overflow-hidden` redundante do root div, pois o AppLayout ja faz o clipping. Manter apenas `min-w-0`.

```
Antes:  <div className="space-y-6 animate-fade-in pb-24 min-w-0 overflow-hidden">
Depois: <div className="space-y-6 animate-fade-in pb-24 min-w-0">
```

### Impacto

- Corrige o overflow em TODAS as paginas do app, nao apenas na visita CRM
- `truncate` passara a funcionar corretamente em qualquer pagina com textos longos
- Zero alteracao de logica, apenas classes Tailwind CSS
- Sera necessario importar `cn` em AppLayout (ja disponivel no projeto)

### Detalhes Tecnicos

Arquivos modificados:
- `src/components/layout/AppLayout.tsx` (linhas 131 e 146)
- `src/pages/crm/CrmVisitaExecucao.tsx` (linha 225, limpeza)

