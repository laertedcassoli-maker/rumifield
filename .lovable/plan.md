

## Ativar todos os clientes para RumiFlow

### O que sera feito
Atualizar todos os registros da tabela `crm_client_products` onde `product_code = 'rumiflow'` para o estagio `ganho`, marcando todos os clientes como ativos nesse produto.

### Dados atuais
- 62 clientes com stage `nao_qualificado`
- 1 cliente com stage `qualificado`
- **Total: 63 registros serao atualizados para `ganho`**

### Detalhes tecnicos

Sera executado um UPDATE via ferramenta de dados (insert tool):

```sql
UPDATE crm_client_products
SET stage = 'ganho', stage_updated_at = now()
WHERE product_code = 'rumiflow';
```

Nenhuma alteracao de codigo ou schema e necessaria. Apenas uma operacao de dados.

