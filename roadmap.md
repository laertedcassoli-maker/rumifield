# Roadmap

## Em andamento
- [x] Dialog de detalhe: navegação em cadeia entre envio e coletas reversas vinculadas (pilha + botão Voltar).
- [x] Motivo/relato obrigatório (ambos os tipos), Quantidade de Volumes e vínculo de ativos na criação de Coleta Reversa (inclusive automática) + revisão exibindo os novos campos.
- [x] Tipo de solicitação fixo na criação: com filtro Envios/Coleta Reversa ativo, "Novo pedido" abre com o tipo travado (badge) e sem o seletor; com "Todos", seletor livre como antes.
- [x] Rótulo "Número do Lacre:" em AssetSearchField + ativo obrigatório na criação para qualquer tipo (Envio incluído).
- [x] Processar de Coleta Reversa sem seção de ativos; Concluir de Coleta Reversa sem NF Adicional (validado no preview).
- [ ] Badges de vínculo no Kanban de pedidos.
- [ ] Pendente decisão do usuário: Phelipe está com role coordenador_servicos (não tecnico_campo) — seletor de técnicos fixos mostra só Roger e Lenilton conforme regra "apenas tecnico_campo".

## Concluído
- [x] Prompt A — Migration: tipo_coleta (CHECK), tecnico_responsavel_user_id, csm_responsavel_user_id em pedidos + função list_pedidos_responsaveis + regen types.ts.
- [x] Prompt B — Formulário Pedidos.tsx: Tipo de Envio só p/ Envio; seletor técnico p/ envio_pelo_tecnico; Tipo de Coleta p/ Coleta Reversa; sub-escolha Técnico/CSM; coleta reversa automática exige Tipo de Coleta; revisão mostra responsável. Validado no preview (Playwright).
- [x] Prompt C — ProcessarPedidoDialog/ConcluirPedidoDialog: 3ª opção "Transportadora" + needsLogistica considerando tipo_solicitacao/tipo_coleta.
- [x] Migration pedidos: tipo_solicitacao, gera_coleta_reversa_automatica, coleta_reversa_origem_id (425 linhas = 'envio').
- [x] Formulário: seletor Envio/Coleta Reversa + geração automática de coleta reversa vinculada.
- [x] Ajustes de labels: menu lateral ("Preventivas", "Solicitação de Peças", "Centro de Serviços"), títulos de página, agrupamento menu_group.
- [x] Submenu "Solicitação de Peças" (Envios / Coleta Reversa) + filtro inicial via ?tipo= + permissões seed.
- [x] Filtro "Tipo de Solicitação" na aba Transmitidos.
