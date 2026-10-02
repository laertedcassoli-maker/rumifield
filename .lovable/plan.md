# Três correções independentes

## Bug 1 — Diálogo "Incluir item no estoque" estourando a largura
- NovoItemDialog (EstoqueUsoConsumo.tsx): `min-w-0` no contêiner `space-y-4` e na lista de resultados (`max-h-48 overflow-auto`); `overflow-x-hidden` no DialogContent.
- Resultados de peça: nome completo quebrando linha (`whitespace-normal break-words`, `min-w-0 flex-1`), selo "Já cadastrado" com `shrink-0`.
- ConsumirDialog (EstoqueConsumoOSSection.tsx): mesma correção (mesmo padrão flex + truncate na lista).
- Conferir com Playwright em 1280px e 375px buscando "CONECTOR".

## Bug 2 — Tela reinicia ao voltar para a aba
- AuthContext: ref com o id do usuário atual. Reset (loading, limpar perfil/papel) só em SIGNED_IN com id diferente.
- Mesmo usuário: atualiza sessão sem loading e revalida perfil/papel em segundo plano; se falhar, mantém o que já está em memória.
- Não troca a referência de user/session quando id e access_token não mudaram.
- signIn (domínio @rumina, validate_rumina_login), signOut e cache offline intocados.

## Bug 3 — Foto de item duplicada
- checklist-item-photo-sync.ts: `Map<itemId, Promise<boolean>>` deduplica chamadas simultâneas de syncItemPhoto; insert trata 23505 como sucesso.
- ChecklistItemPhoto.tsx: remover a chamada direta em handleFile; o useEffect (localSig) passa a ser o único gatilho. A chamada no envio antes de concluir continua, protegida pela deduplicação.
- Migração: apagar duplicatas (mesmo item_id + photo_path, manter a mais antiga) nas duas tabelas — hoje há 4 grupos duplicados em instalação e 0 em preventiva; arquivos do storage não são apagados. Depois UNIQUE (item_id, photo_path) em ambas.
- Limite de 5 fotos, foto obrigatória, fila offline e RLS intocados.

## Verificação
Typecheck; Playwright no Bug 1 (duas larguras) e no Bug 2 (ocultar/mostrar aba mantém diálogo); consulta confirmando zero duplicatas e a constraint criada. Nada será publicado.
