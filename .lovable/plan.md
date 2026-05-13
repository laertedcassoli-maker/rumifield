## Objetivo
Garantir que qualquer peça cadastrada no catálogo possa ser adicionada ou vinculada em todos os fluxos relevantes, sem depender de estoque, e impedir que peças válidas desapareçam indevidamente do catálogo.

## O que vou implementar
1. **Corrigir a origem do problema no sincronismo do catálogo**
   - Ajustar a rotina de sincronização de peças para não desativar automaticamente itens cadastrados só porque não vieram na resposta atual da integração.
   - Preservar a disponibilidade de peças já cadastradas no catálogo, tratando `ativo` como critério de disponibilidade funcional e `quantidade_estoque` apenas como informação.

2. **Reativar e preservar as peças afetadas**
   - Reativar as peças de exemplo identificadas (`PRD00634`, `PRD00636`, `PRD00607`) para que voltem a aparecer imediatamente nos seletores.
   - Validar se a regra cobre também outras peças que foram desativadas pelo mesmo comportamento.

3. **Padronizar os fluxos que adicionam/vinculam peças**
   - Revisar os fluxos de pedidos, edição de pedidos, solicitações em chamados e consumos/vínculos em preventivas para garantir consistência no catálogo exibido.
   - Manter como critério único de exibição a peça estar cadastrada e ativa no catálogo, sem qualquer bloqueio por estoque zero.

4. **Validar o comportamento ponta a ponta**
   - Confirmar que os códigos informados passam a aparecer nos fluxos principais.
   - Verificar que criação e edição continuam funcionando sem regressão nos filtros existentes.

## Detalhes técnicos
- Hoje os fluxos já consultam peças com filtro `ativo = true`; o problema encontrado não está no estoque e sim no fato de que os códigos informados estão salvos com `ativo = false`.
- Situação atual encontrada no banco:
  - `PRD00634` — cadastrada, estoque `0`, porém inativa
  - `PRD00636` — cadastrada, estoque `0`, porém inativa
  - `PRD00607` — cadastrada, estoque `0`, porém inativa
- A função de sincronização atual marca como inativas as peças que não aparecem no retorno da integração, o que explica o desaparecimento desses itens em todos os seletores.
- A implementação deve combinar:
  - ajuste no código da sincronização
  - ajuste de dados para reativar as peças afetadas
  - checagem dos componentes que consomem o catálogo para manter comportamento uniforme

## Resultado esperado
- Peças com estoque `0` continuam disponíveis para adicionar/vincular.
- Peças cadastradas não somem dos fluxos por desativação indevida da sincronização.
- Os códigos `PRD00634`, `PRD00636` e `PRD00607` passam a aparecer normalmente onde o usuário precisa selecionar peças.