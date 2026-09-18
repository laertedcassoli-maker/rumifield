# Excluir instalação na listagem de Instalações

## Contexto atual (verificado)
- `src/pages/instalacoes/Index.tsx` renderiza cada instalação como Card (linhas ~298–385) e não tem nenhuma ação de exclusão.
- `canManage` (linha 64) = `!isTecnicoCampo` — já cobre o gate pedido.
- A RLS já permite DELETE para `can_manage_installations()` e as FKs de `installation_stages` → tabelas de execução são `ON DELETE CASCADE` (verificado na listagem de tabelas do banco). Nenhuma migration é necessária.
- Padrão de confirmação a copiar: `AlertDialog` de `src/pages/Pedidos.tsx` (linhas 3071–3090), usando os componentes de `src/components/ui/alert-dialog.tsx`.

## Mudanças (só em `src/pages/instalacoes/Index.tsx`)

1. **Imports**: adicionar `Trash2` ao import de `lucide-react` e os componentes `AlertDialog*` de `@/components/ui/alert-dialog`.

2. **Estado**: `const [instalacaoParaExcluir, setInstalacaoParaExcluir] = useState<InstallationRow | null>(null);`

3. **Mutation `deleteInstallationMutation`**:
   - `mutationFn`: `supabase.from('installations').delete().eq('id', id)` — validando via `.select('id')` (padrão do projeto para detectar falha silenciosa de RLS).
   - `onSuccess`: invalidar `['installations']`, toast "Instalação excluída!" e fechar o dialog.
   - `onError`: toast de erro com a mensagem.

4. **Botão no card**: no cabeçalho do card (`CardHeader`, junto do Badge de status), para `canManage` apenas, um `Button` `variant="ghost"` `size="sm"` (ou ícone pequeno discreto) com `Trash2`, que abre o dialog de confirmação com a instalação selecionada.

5. **AlertDialog de confirmação** (mesma estrutura do Pedidos.tsx):
   - Título: "Excluir instalação permanentemente?"
   - Descrição: aviso claro de que a ação é irreversível e remove a instalação com **todas as suas etapas, checklists respondidos e consumo de peças**.
   - Cancelar / Confirmar exclusão (com `Loader2` enquanto `isPending`, botões desabilitados durante a exclusão).

## Não alterado
- Criação, filtro por etapa (`?etapa=`), fluxo de execução, RLS, schema.
- Nada de exclusão de etapa individual.
- tecnico_campo continua sem ver o botão (`canManage` gate).

## Critérios de aceite
- Gestor (admin/coordenador_rplus/consultor_rplus/coordenador_servicos) vê o botão em cada card e consegue excluir com confirmação; lista atualiza na hora.
- tecnico_campo não vê o botão.
- Typecheck e build limpos; validação no preview (criar instalação de teste → excluir → some da lista e do banco).
