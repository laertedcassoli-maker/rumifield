

## Usar dominio publicado nos links de convite

**Problema**: Os links de convite usam `window.location.origin`, o que faz com que links gerados no ambiente de preview apontem para o dominio de preview ao inves do dominio publicado.

**Solucao**: Substituir `window.location.origin` por uma constante com o dominio publicado em dois pontos do arquivo `src/pages/admin/Usuarios.tsx`.

### Alteracoes

**Arquivo: `src/pages/admin/Usuarios.tsx`**

1. **Linha 277** - Criacao do link ao gerar convite:
   - De: `` `${window.location.origin}/convite/${invite.token}` ``
   - Para: `` `https://rumifield.lovable.app/convite/${invite.token}` ``

2. **Linha 307** - Copia do link de convites pendentes:
   - De: `` `${window.location.origin}/convite/${token}` ``
   - Para: `` `https://rumifield.lovable.app/convite/${token}` ``

Sao apenas 2 linhas de mudanca. Todos os links de convite passarao a apontar para o dominio de producao independentemente de onde forem gerados.

