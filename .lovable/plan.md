

## Problema

O botao de voltar na tela Cliente 360 esta fixo em `/crm/carteira`. Quando voce acessa um cliente a partir do Pipeline (`/crm/pipeline`), ao clicar em voltar, ele vai para a Carteira ao inves de retornar ao Pipeline.

## Solucao

Usar `useNavigate` com `navigate(-1)` (equivalente ao botao "voltar" do navegador) no lugar do `Link` fixo. Isso faz o usuario retornar sempre para a tela de onde veio -- seja Pipeline, Carteira, ou qualquer outra.

## Detalhes tecnicos

**Arquivo**: `src/pages/crm/CrmCliente360.tsx`

1. Importar `useNavigate` de `react-router-dom` (remover ou manter `Link` se usado em outro lugar)
2. Substituir o `<Link to="/crm/carteira">` do botao de voltar por um `<Button onClick={() => navigate(-1)}>`
3. Isso cobre todos os pontos de entrada (Carteira, Pipeline, Visitas, etc.)

