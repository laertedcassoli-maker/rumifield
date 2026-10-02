# Estoque Uso/Consumo — unidade, controle a granel, baixa com motivo e atalhos

## Achado no banco (confirmado)
A tabela de movimentos tem **duas** regras de gravação ativas, e elas se somam:
- "Insert estoque movimentos by tipo" (a antiga, da Fase 1)
- "Insert movimentos estoque consumo" (a atual, com a exceção do carrinho)

Se só a atual for restringida, a antiga continua liberando a saída no estoque de qualquer técnico. Proposta: substituir as duas por **uma única regra** com todas as condições de hoje mais a nova restrição. Nada muda para quem já pode gravar, exceto a saída no estoque de outro técnico.

## O que muda na tela
1. **Unidade** (un, m, kg, L, cx, rolo, par, pç) no cadastro e na edição; vem como "un" quando o item é criado a partir de peça do catálogo. Aparece ao lado de toda quantidade e saldo: lista, histórico, carrinho, OS e visita.
2. **Quantidade**: un, par, pç, cx e rolo só aceitam números inteiros; m, kg e L aceitam decimais. Vale para todos os campos de quantidade do estoque.
3. **Controle de consumo**: "Por uso" (padrão, como hoje) ou "A granel", com texto de ajuda e selo "A granel" na lista. Itens a granel não aparecem ao consumir na OS nem na visita.
4. **Carrinho**: item a granel pede motivo (3 a 200 caracteres) e mostra "Baixa direta — não vai para o seu estoque". Ao finalizar, só sai do Centro de Serviços, com o motivo gravado. Sem motivo não finaliza.
5. **Centro de Serviços**: "Dar baixa" com motivo obrigatório; "Receber material" com observação opcional.
6. **Por técnico**: na linha do próprio técnico, botão "Dar baixa" com quantidade e motivo, bloqueado acima do saldo e sem sinal. Quem tem "Incluir item/Receber material" pode dar baixa no estoque de outro técnico.
7. **Histórico** do item mostra o motivo ou a observação de cada movimento.
8. **Novos nomes**: "Incluir item no estoque", "Receber material", "Dar baixa", "Retirar para o meu estoque" (card do Início, título da tela e botões). Na tela de Permissões, as colunas passam a se chamar "Incluir item/Receber material" e "Retirar/Dar baixa".
9. **Atalhos para a retirada**: botão no cabeçalho do Estoque e subitem no menu lateral, abaixo de "Estoque Uso/Consumo". Os dois só aparecem para quem tem "Retirar/Dar baixa". O card do Início continua.

## O que não muda
Consumo de peças e NF, peças usadas na OS, tabela de peças, regras de leitura, movimentos imutáveis e o envio da visita sem sinal (sem duplicar). Nada é publicado.

## Detalhes técnicos
- Migração: `unidade text NOT NULL DEFAULT 'un'` com CHECK nas 8 unidades e `controle_consumo text NOT NULL DEFAULT 'por_uso'` com CHECK (`por_uso`, `a_granel`). Também apaga as 2 policies de INSERT e cria uma nova:
  `(tipo='entrada' AND (can_manage OR (local='tecnico' AND tecnico_user_id=auth.uid() AND can_registrar_saida))) OR (tipo='saida' AND can_registrar_saida AND (local='centro_servicos' OR tecnico_user_id=auth.uid() OR can_manage))`. Sem UPDATE e sem DELETE. Os tipos do banco são gerados de novo.
- Visita: a saída é sempre no estoque do técnico da visita. Se quem está logado não for esse técnico nem tiver "Incluir item/Receber material", o banco recusa. Na fila sem sinal, essa recusa não é erro de rede.
- Itens a granel ficam fora da busca na OS e na visita. Pelo vínculo com a peça (`findItemByPeca`), também não descontam do estoque do técnico.
- Cache do aparelho: entram `unidade` e `controle_consumo` no select de `refreshEstoqueCache` e no tipo do cache. Como não são campos de busca, a versão do banco do aparelho não muda.
- Validação de quantidade em um único lugar, usado em EstoqueUsoConsumo, RetirarEstoque, EstoqueConsumoOSSection e ConsumedPartsBlock.
- Também mudam: Home.tsx, AppSidebar.tsx (`handleMenuClick` e marcação da página ativa) e Permissoes.tsx (só os rótulos).
