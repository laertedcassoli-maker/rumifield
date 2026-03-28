
Objetivo: manter o salvamento 100% online como está hoje, mas mudar a exibição para um modelo “shadow cache determinístico”, para que a peça apareça imediatamente no mobile sem depender de Forçar Atualização.

Diagnóstico (confirmado)
- As peças da PREV-2026-00002 estão sendo gravadas no backend.
- O problema é de renderização imediata: respostas de leitura atrasadas podem substituir o cache otimista e esconder temporariamente as peças.

Estratégia diferente (sem depender de sync manual)
1) Transformar a lista de peças em “merge por ID” (não substituição cega)
- Arquivo: `src/components/preventivas/ConsumedPartsBlock.tsx`
- Ajustar `queryFn` de `preventive-consumed-parts` para:
  - Buscar dados online normalmente.
  - Ler cache atual da própria query.
  - Mesclar `server + cache otimista` por `id` (server prevalece quando existir).
- Efeito: se a leitura online vier atrasada, ela não apaga a peça recém-criada no cache local da query.

2) Blindar mutações do checklist contra sobrescrita de request em voo
- Arquivo: `src/components/preventivas/ChecklistExecution.tsx`
- Antes de aplicar `setQueryData` de peças automáticas:
  - `queryClient.cancelQueries({ queryKey: ['preventive-consumed-parts', preventiveId] })`
- Depois:
  - manter `setQueryData` (upsert por `id`) como fonte imediata da UI.
  - manter `invalidateQueries(..., refetchType: 'none')` (sem refetch agressivo imediato).
- Efeito: evita que uma resposta antiga de rede derrube a peça que acabou de entrar no cache.

3) Corrigir inconsistência de ID no fluxo manual (ajuste colateral importante)
- Arquivo: `src/components/preventivas/ConsumedPartsBlock.tsx`
- Hoje o `onSuccess` da peça manual usa `crypto.randomUUID()` novo (diferente do ID inserido).
- Ajustar para usar exatamente o mesmo `id` do payload inserido.
- Efeito: elimina duplicidade/fantasma no cache e melhora consistência visual no mobile.

4) Regras de reconciliação
- Continuar gravando online como fonte oficial.
- Não depender do Dexie para peça automática aparecer.
- Dexie permanece apenas como apoio offline já existente, sem virar fonte principal da tela em modo online.

Validação (mobile, sem Forçar Atualização)
1. PREV-2026-00002: marcar NC + ação “Troca” e confirmar peça aparecendo na hora.
2. Repetir em 2 itens seguidos (toques rápidos) e confirmar que nenhuma peça “some”.
3. Sair e “Continuar” visita: checklist e peças permanecem visíveis.
4. Confirmar que remoção de NC/ação remove peça da lista imediatamente.
5. Confirmar que o botão “Forçar Atualização” não é mais necessário nesse fluxo.

Impacto
- Sem migration.
- Sem mudança de regra de negócio.
- Foco total em consistência de UI no mobile com persistência online preservada.
