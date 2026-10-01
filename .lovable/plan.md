# Estoque Uso/Consumo — Fase 2 (tela principal)

## 0. Complemento da Fase 1
Uma migração com o INSERT das 4 linhas de `estoque_uso_consumo`, com os mesmos valores que já estão no banco, usando `ON CONFLICT (role, menu_key) DO NOTHING`. A restrição única existe. Não muda nenhum dado, só deixa registrado na migração.

## 1. Endereço e menu
- `/estoque-uso-consumo` dentro do layout autenticado, no mesmo padrão das outras páginas em `App.tsx`.
- Entrada "Estoque Uso/Consumo" no menu lateral com permKey `estoque_uso_consumo`, logo abaixo de Solicitação de Peças. Só aparece para quem tem acesso; quem não tem uma linha de permissão fica sem acesso, como já acontece hoje.

## 2. Tela (`src/pages/EstoqueUsoConsumo.tsx`)
- **Filtros:** botões "Todos" / "Centro de Serviços" / "Por técnico". Em "Por técnico" aparece uma lista com só os técnicos que têm saldo maior que zero em algum item, com o nome vindo de `profiles`. Também há busca por código ou descrição.
- **Tabela:** Código, Descrição, Local (Centro de Serviços ou nome do técnico) e Quantidade. Itens controlados ganham um selo "Controlado".
- **Saldo:** calculado na tela a partir dos movimentos, somando as entradas e tirando as saídas, agrupado por item, local e técnico. Nada de saldo armazenado.
  - Itens sem nenhum movimento aparecem em "Todos" e "Centro de Serviços" com quantidade 0, para que o item recém-criado possa ser visto.
- **Histórico:** clicar numa linha abre uma janela com os movimentos daquele item naquele local, do mais recente para o mais antigo. Mostra tipo, quantidade, origem, data/hora, quem registrou e observação.
- **"Novo item"** (só com permissão de Editar): código, descrição e opção "Item Uso/Consumo" ou "Item Controlado".
  - Em "Item Controlado", uma busca nas peças ativas do catálogo, por código ou nome, grava a peça vinculada.
  - Código repetido mostra um aviso claro.
- **"Dar entrada"** (só com Editar): item ativo, quantidade maior que zero e observação opcional. Grava entrada no Centro de Serviços com origem "ajuste".
- **"Dar saída"** (só com Excluir): mesmo formulário, gravando uma saída no Centro de Serviços com origem "ajuste". Mostra o saldo atual e não deixa sair mais do que o saldo, com um aviso explicando.
- Toda gravação confere se o registro voltou do banco (padrão do projeto), espera no máximo 12s e atualiza a tabela depois.

## Não muda
Tabelas, regras de acesso e funções da Fase 1, além da tabela `pecas` (só consultada). Sem carrinho, OS ou visita. Nada publicado.

## Verificação
- Typecheck.
- Abrir a tela logado como admin.
- Criar um item de teste, dar entrada e saída e conferir que o saldo bate com a soma no banco.
- O item de teste fica gravado, porque os movimentos não podem ser excluídos. Vou avisar qual é para você decidir.
