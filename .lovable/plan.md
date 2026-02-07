
# Exibir data de qualificacao no card de Oportunidades

## O que sera feito
Adicionar a data de qualificacao (campo `stage_updated_at`) ao lado direito de cada card na secao "Oportunidades" da pagina Cliente 360.

## Resultado visual
O card passara de:
```text
| Ideagri  Qualificado                              |
```
Para:
```text
| Ideagri  Qualificado                    07/02/2026 |
```

## Detalhes tecnicos

### Arquivo: `src/pages/crm/CrmCliente360.tsx`
- No bloco de renderizacao das oportunidades (linhas ~156-168), adicionar a exibicao de `op.stage_updated_at` formatada com `date-fns` no formato `dd/MM/yyyy`
- Exibir ao lado do valor estimado (ou no lugar dele caso nao exista valor)
- Usar o campo `stage_updated_at` da tabela `crm_client_products`, que ja e retornado na query existente
- Nenhuma alteracao de query ou banco necessaria
