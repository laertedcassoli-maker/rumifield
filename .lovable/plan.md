

## Simplificar listagem de Visitas CRM

### O que muda

1. **Remover agrupamento por data de criacao (Hoje/Ontem/etc.)** -- a lista sera uma sequencia plana de cards, sem headers de grupo.

2. **Enriquecer cada card com informacoes adicionais:**
   - **Data de criacao**: exibir abaixo da fazenda em formato compacto (ex: "Criado em 06/02 as 14:30")
   - **Usuario responsavel**: buscar o nome do `owner_user_id` via join com a tabela `profiles` e exibir no card (ex: "por Joao Silva")

### Detalhes tecnicos

**Arquivo: `src/pages/crm/CrmVisitas.tsx`**

- Alterar a query para incluir join com profiles: `select('*, clientes(...), profiles:owner_user_id(nome)')` (ou campo equivalente na tabela profiles)
- Remover o `useMemo` de `grouped` e a logica de `isToday`/`isYesterday`
- Renderizar `filteredVisitas` diretamente como lista plana (sem `Object.entries(grouped)`)
- Adicionar no card, abaixo da fazenda/objetivo, uma linha com icone de relogio + data de criacao formatada + nome do usuario

**Layout do card atualizado:**

```text
+-------+-------------------------------------------+---+
| FEV   | CLIENTE NOME        [Planejada]  [pin]    | > |
|  26   | Fazenda XYZ                                |   |
|       | Criado 06/02 14:30 · por João Silva        |   |
+-------+-------------------------------------------+---+
```

Antes de implementar, preciso verificar o schema da tabela `profiles` para confirmar o campo de nome disponivel.
