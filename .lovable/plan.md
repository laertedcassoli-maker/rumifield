# Tipo de solicitação no formulário de peças: Envio vs. Coleta Reversa

Adiciona ao formulário de criação de "Solicitação de Peças" a escolha entre **Envio** (padrão) e **Coleta Reversa**, e a opção de já gerar a coleta reversa junto com o envio.

## O que muda para o usuário

1. **Novo seletor no topo do formulário** — "Tipo de Solicitação": Envio (já selecionado) ou Coleta Reversa. Mesmo visual dos botões de Urgência e Tipo de Envio.
2. **Só quando "Envio" está selecionado**, aparece a pergunta "Gera automaticamente coleta reversa?" com Sim / Não (padrão Não).
3. **Salvando um Envio com "Sim"**: são criadas duas solicitações — o envio e uma coleta reversa com exatamente as mesmas peças e quantidades, vinculada ao envio de origem. A mensagem de sucesso avisa que as duas foram criadas.
4. **Se a coleta reversa automática falhar**, o envio já salvo é mantido (nada é desfeito) e aparece um aviso explicando que a coleta reversa não foi gerada e pode ser criada manualmente depois.
5. **Coleta Reversa selecionada**: salva uma única solicitação desse tipo, sem exigir envio associado, e a pergunta de geração automática não aparece.
6. **Envio sem marcar "Sim"** continua exatamente como hoje: uma única solicitação, mesmo fluxo de rascunho e transmissão.

Na tela de revisão antes de salvar, o tipo escolhido e a indicação de coleta reversa automática aparecem junto dos outros dados resumidos.

## Detalhes técnicos

Arquivo único: `src/pages/Pedidos.tsx`.

- Estado do formulário (`form`, linha 58) ganha `tipo_solicitacao: 'envio'` e `gera_coleta_reversa: false`. Os quatro pontos que hoje resetam o form (linhas 363, 541, 637 e `handleCloseDialog`) passam a incluir esses dois campos com os mesmos padrões.
- `openEdit` (~linha 471) carrega `tipo_solicitacao` do pedido existente; o seletor fica **desabilitado ao editar** (o tipo não muda depois de criado) e a opção automática não é exibida na edição — o ramo `editingPedido` do `handleSubmit` continua intocado.
- UI: dois blocos `ToggleGroup type="single"` no mesmo padrão dos existentes — "Tipo de Solicitação" inserido antes do campo Cliente, e "Gera automaticamente coleta reversa?" renderizado condicionalmente (`form.tipo_solicitacao === 'envio' && !editingPedido`) junto aos demais toggles.
- `handleSubmit`, ramo de criação (linhas 595-633): o insert do pedido passa a enviar `tipo_solicitacao: form.tipo_solicitacao`, `gera_coleta_reversa_automatica: form.tipo_solicitacao === 'envio' && form.gera_coleta_reversa`. Rollback atual do insert de itens permanece igual.
- Após o envio e seus `pedido_itens` salvarem com sucesso, se a opção estiver marcada: novo insert em `pedidos` (mesmos cliente, urgência, tipo de envio, observações, solenoide, `status: 'rascunho'`) com `tipo_solicitacao: 'coleta_reversa'`, `gera_coleta_reversa_automatica: false`, `coleta_reversa_origem_id: pedido.id`; em seguida os mesmos `itens` em `pedido_itens`. Tudo dentro de um `try/catch` próprio: falha → `toast` destrutivo de aviso ("Coleta reversa não gerada… crie manualmente"), sem apagar o envio e sem interromper o fechamento do dialog. Se os itens da coleta reversa falharem, apenas a coleta reversa recém-criada é removida.
- Validação em `handleShowConfirmation` permanece a mesma (cliente, peças, modelo de solenoide) para os dois tipos.
- `applyAutoLinks`, fluxo de rascunho/transmissão, filtros da listagem e o dialog de detalhe não são alterados nesta etapa.

## Ajuste extra: alinhamento do item "Manutenção Preventiva" no menu lateral

`src/components/layout/AppSidebar.tsx`, linhas 243-249: o gatilho envolve ícone/texto/seta num `<button className="w-full">` dentro de `SidebarMenuSubButton asChild`, o que quebra o alinhamento. Correção: remover `asChild` e o `<button>` extra, deixando `Calendar`, `<span>Manutenção Preventiva</span>` e `ChevronDown` como filhos diretos de `SidebarMenuSubButton isActive={isPreventivasActive}` — igual aos demais gatilhos do arquivo. Comportamento do Collapsible, itens filhos e permissões permanecem intactos.
