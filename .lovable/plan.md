

## Otimizacao Mobile da Pagina de Visita CRM

### Problemas Identificados

Com base na captura de tela em 390px (iPhone), identifiquei os seguintes problemas:

1. **Botoes de acao cortados** - Os botoes "+ Acao", "Finalizar" e "Cancelar" ficam em uma unica linha e nao cabem na tela, com "Finalizar" e "Cancelar" cortados
2. **Metricas dos produtos cortadas** - O grid de metricas dentro dos ProductCards usa `grid-cols-2` com `gap-x-4`, fazendo o texto ultrapassar a largura do card
3. **Titulo do cliente muito longo** - O nome "Agro Pecuaria Gato Do Mato Ltda" nao quebra linha e ultrapassa a tela

### Solucao

#### 1. Botoes de acao - empilhar em mobile (CrmVisitaExecucao.tsx)

**Quando `isActive`**: Os 3 botoes ("+ Acao", "Finalizar", "Cancelar") serao reorganizados:
- "Finalizar" e "+ Acao" ficam em uma linha (flex, cada um `flex-1`)
- "Cancelar" vai para uma segunda linha menor, centralizado

**Quando `isPlanned`**: Os 2 botoes ("Fazer Check-in" e "Cancelar") ja cabem, mas vou garantir que usem `flex-wrap` como seguranca.

#### 2. Metricas dos produtos - layout responsivo (ProductCard.tsx)

- Trocar o grid de metricas de `grid-cols-2` para `grid-cols-1` em mobile (`grid-cols-1 sm:grid-cols-2`)
- Reduzir `gap-x-4` para `gap-x-2`
- Isso garante que cada metrica ocupe a largura total no celular

#### 3. Titulo do cliente - truncar com ellipsis (CrmVisitaExecucao.tsx)

- Adicionar `truncate` ao `h1` do nome do cliente para evitar overflow horizontal

#### 4. Botoes de acao cortados na visita ativa - reorganizar layout

- Usar `flex-wrap gap-2` nos botoes para que quebrem naturalmente em telas pequenas
- Botoes principais terao `min-w-0` para permitir compressao

### Detalhes Tecnicos

**Arquivos a modificar:**

1. `src/pages/crm/CrmVisitaExecucao.tsx`
   - Linha 232: adicionar `truncate` ao h1
   - Linhas 289-301: reorganizar botoes `isActive` com `flex-wrap`
   - Linhas 277-287: adicionar `flex-wrap` nos botoes `isPlanned`

2. `src/components/crm/ProductCard.tsx`
   - Linha 108: mudar grid de metricas para `grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1.5`

Todas as mudancas sao apenas classes Tailwind CSS, sem alteracao de logica.

