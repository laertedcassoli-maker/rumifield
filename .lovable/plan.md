

## Simplificar: Remover seção "Oportunidades"

### Diagnóstico

A tela Cliente 360 exibe 3 blocos que se sobrepõem:

1. **Produtos** - Cards com estágio do funil, métricas de saúde e ações (qualificar, proposta, negociação)
2. **Oportunidades** - Lista dos mesmos produtos filtrados por estágio (qualificado/proposta/negociação) com valor e data
3. **Propostas** - Registros formais de proposta comercial (valor proposto, validade, status)

A seção "Oportunidades" é redundante: repete informações já visíveis nos cards de Produtos (estágio, valor estimado, data de qualificação).

### Mudança proposta

**Arquivo: `src/pages/crm/CrmCliente360.tsx`**

- **Remover** todo o bloco "Oportunidades" (o `if openOpps.length > 0` com seu conteúdo)
- **Remover** a variável `openOpps` que não será mais usada
- **Manter** a seção "Propostas" como está, pois traz dados distintos (valor proposto, validade, status do documento)

### Resultado

A aba "Produtos" ficará com:
1. Cards de Produtos (com estágio e saúde)
2. Ações
3. Propostas (quando houver)
4. Visitas Recentes

Menos repetição, informação mais direta.

