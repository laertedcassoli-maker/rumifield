
## Destacar Código da SP na Seção de Solicitações de Peças

### Problema
Na seção "Solicitações de Peças" do detalhe do chamado, o código da SP (SP-00000038) não está visível. Apenas a data, status e itens são exibidos. O código é importante para referência rápida.

### Solução
Adicionar o código da SP de forma destacada na renderização de cada solicitação.

**Implementação em `src/pages/chamados/DetalheChamado.tsx` (linhas 693-713)**

Modificar o bloco de renderização das solicitações de peças para:
1. Exibir o **código da SP** (propriedade `pedido_id`) de forma destacada em um badge/tag visível
2. Posicionar junto à data ou em destaque separado
3. Usar um estilo que chame atenção (ex: cor diferente, font-mono)

**Estrutura proposta:**
```
[Data] [SP-CÓDIGO] [Status]
├─ IMP0094 - VÁLVULA SOLENOIDE ×1
```

Ou:

```
[SP-CÓDIGO] [Status]
Data: 11/02/2026 às 17:18
├─ IMP0094 - VÁLVULA SOLENOIDE ×1
```

### Mudanças Específicas
- Linha 694-700: Adicionar uma row com o código da SP em um badge/tag destacado (ex: bg-primary/10, font-bold)
- Usar formato consistente com outros códigos do sistema (ex: "SP-00000038")

### Resultado Esperado
O código da SP fica imediatamente visível e destacado, facilitando referência rápida e rastreabilidade.

