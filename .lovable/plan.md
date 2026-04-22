

## Diagnóstico: não é bug de permissão — é fluxo de UX

Investiguei a rota `PREV-2026-00002` do Roger. **Não há erro de RLS.** Prova:
- Roger já encerrou com sucesso a 1ª fazenda (status `concluida`).
- Está travado na 2ª fazenda (MELKSTAD) — mas as policies funcionaram na 1ª, então não pode ser permissão.
- Logs do Postgres não mostram nenhum erro vindo da sessão dele.

### O que realmente está acontecendo

Estado atual da 2ª visita do Roger:

| Verificação | Status |
|---|---|
| Itens do checklist respondidos | ✅ 3/3 |
| Fotos anexadas | ✅ 1 |
| Peças com origem definida | ✅ ok |
| **Checklist marcado como "Concluído"** | ❌ ainda em `em_andamento` |

O botão "Encerrar Visita" só fica habilitado quando `checklistStatus === 'completed'` (linha 335 de `AtendimentoPreventivo.tsx`). Roger respondeu todos os itens mas **não clicou no botão "Finalizar Checklist"** dentro da tela de execução do checklist — então o status permanece `em_andamento` e o "Encerrar" fica bloqueado/falha.

É um problema de fluxo em 2 etapas pouco evidente:
1. Responder todos os itens → clicar **"Finalizar Checklist"** (vira `concluido`)
2. Voltar para a tela da fazenda → clicar **"Encerrar Visita"**

Roger pulou a etapa 1.

### Plano de correção (UX)

Pequeno ajuste em `src/pages/preventivas/AtendimentoPreventivo.tsx` para o problema não se repetir com outros técnicos:

1. **Mensagem clara no botão**: quando `canFinishVisit` for `false` por causa do checklist em andamento, mostrar texto explícito tipo *"Finalize o checklist primeiro"* abaixo/no botão "Encerrar Visita" (em vez de só ficar desabilitado em silêncio).

2. **Toast educativo ao clicar**: manter o botão clicável e, ao clicar com checklist em `em_andamento`, mostrar toast explicando: *"Você precisa finalizar o checklist (botão verde no fim da lista de itens) antes de encerrar a visita."* — alinhado com a memória `mem://ui-patterns/validation-feedback-behavior`.

3. **Atalho visual**: mostrar um aviso amarelo no topo da tela "Atendimento" se o checklist estiver `em_andamento` com 100% dos itens respondidos, lembrando o técnico de finalizar.

### Ação imediata para o Roger

Pedir para ele:
1. Abrir a tela do checklist da MELKSTAD,
2. Rolar até o fim e clicar no botão **"Finalizar Checklist"**,
3. Voltar e clicar em **"Encerrar Visita"** — vai funcionar normalmente.

Sem necessidade de mudança em RLS, banco ou policies. Confirma que pode aplicar os 3 ajustes de UX acima?

