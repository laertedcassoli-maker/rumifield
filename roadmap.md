# Roadmap

## Em andamento
- [ ] Prompt A — Migration: tipo_coleta (CHECK correios/coleta_tecnico_csm/apenas_nf), tecnico_responsavel_user_id, csm_responsavel_user_id em pedidos + regen types.ts.
- [ ] Prompt B — Formulário Pedidos.tsx: Tipo de Envio só p/ Envio; seletor técnico (Phelipe/Roger/Lenilton) p/ envio_pelo_tecnico; Tipo de Coleta p/ Coleta Reversa; sub-escolha Técnico/CSM; coleta reversa automática exige Tipo de Coleta; revisão mostra responsável.
- [ ] Prompt C — ProcessarPedidoDialog/ConcluirPedidoDialog: 3ª opção "Transportadora" + needsLogistica considerando tipo_solicitacao/tipo_coleta.
- [ ] (Futuro) Dialog de detalhe/vínculo de coleta reversa — aguardando o usuário.

## Concluído
- [x] Migration pedidos: tipo_solicitacao, gera_coleta_reversa_automatica, coleta_reversa_origem_id (425 linhas = 'envio').
- [x] Formulário: seletor Envio/Coleta Reversa + geração automática de coleta reversa vinculada.
- [x] Ajustes de labels: menu lateral ("Preventivas", "Solicitação de Peças", "Centro de Serviços"), títulos de página, agrupamento menu_group.
- [x] Submenu "Solicitação de Peças" (Envios / Coleta Reversa) + filtro inicial via ?tipo= + permissões seed.
- [x] Filtro "Tipo de Solicitação" na aba Transmitidos.
