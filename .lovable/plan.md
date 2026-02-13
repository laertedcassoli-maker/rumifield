

## Adicionar overlay escuro ao Popover do Pipeline

### Objetivo
Destacar o Popover de interacoes escurecendo o fundo atras dele, criando um efeito de foco visual.

### Solucao
Utilizar o componente `PopoverAnchor` nao e necessario. A abordagem mais simples e adicionar um overlay global via CSS usando o atributo `data-state` que o Radix Popover ja injeta automaticamente.

### Detalhes Tecnicos

**Arquivo: `src/pages/crm/CrmPipeline.tsx`**

Envolver o `Popover` com um estado controlado (`open`) e renderizar um `div` de overlay condicional quando o popover estiver aberto:

1. Converter o `Popover` para modo controlado com `open` e `onOpenChange`
2. Renderizar um overlay fixo (`fixed inset-0 bg-black/40 z-40`) quando o popover estiver aberto
3. O `PopoverContent` ja possui `z-50`, entao ficara acima do overlay

```tsx
const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);

// No JSX, dentro do map:
<Popover
  open={openPopoverId === p.id}
  onOpenChange={(open) => setOpenPopoverId(open ? p.id : null)}
>
  ...
</Popover>

// Overlay global (renderizado uma vez, fora do map):
{openPopoverId && (
  <div
    className="fixed inset-0 bg-black/40 z-40"
    onClick={() => setOpenPopoverId(null)}
  />
)}
```

### Resultado
- Ao abrir o popover, o fundo escurece com uma camada semi-transparente
- Clicar no overlay fecha o popover
- O popover fica em destaque acima do overlay

