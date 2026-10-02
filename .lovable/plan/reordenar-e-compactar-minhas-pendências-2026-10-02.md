# Reordenar e compactar Minhas Pendências

## Alteração
- Montar uma lista declarativa das seções na ordem atual, incluindo somente as seções condicionais que o usuário já pode ver.
- Enquanto qualquer seção visível estiver carregando, renderizar essa lista na ordem original.
- Depois que todas terminarem, fazer uma ordenação estável em dois grupos: primeiro seções com `count > 0`, depois seções com `count = 0`, preservando a ordem original dentro de cada grupo.
- Usar uma chave fixa por seção na renderização, para que a mudança de posição não recrie seus componentes.
- Manter seções com pendências no formato atual, incluindo conteúdo, links e “Ver mais”.
- Renderizar seções vazias em uma linha compacta com ícone, título, selo `0`, link “Ver todas” quando já existir e o texto “Nenhuma pendência”.

## Intocado
- Consultas, contagens, permissões e regras condicionais.
- Destinos dos links e comportamento de “Ver mais”.
- Conteúdo e ordem dos itens dentro de cada seção.
- Comportamento no banco e demais telas.

## Critérios de verificação
- Com pendências apenas em Instalações, essa seção aparece primeiro.
- Todas as demais seções visíveis aparecem abaixo, compactas e na ordem relativa atual.
- Durante qualquer carregamento, a ordem permanece original.
- Aprovações e Pedidos com a Logística continuam condicionados às permissões atuais.
