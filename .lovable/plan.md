
## Botao de Navegacao (Google Maps) nas Visitas CRM

### O que muda para o usuario
Cada card de visita na listagem tera um icone de navegacao (seta/bussola) que abre o Google Maps com a localizacao da fazenda do cliente. O icone so aparece quando o cliente possui coordenadas cadastradas (`latitude`/`longitude`) ou `link_maps`. Ao tocar, o Maps abre em nova aba sem navegar para dentro da visita.

### Detalhes tecnicos

#### Alteracoes em `src/pages/crm/CrmVisitas.tsx`

1. **Ampliar o select da query** de visitas para incluir `latitude`, `longitude` e `link_maps` do cliente:
   - De: `clientes(nome, fazenda, cidade, estado)`
   - Para: `clientes(nome, fazenda, cidade, estado, latitude, longitude, link_maps)`

2. **Adicionar icone `Navigation`** (do lucide-react) em cada card, posicionado entre o conteudo e o `ChevronRight`, visivel apenas quando o cliente tem coordenadas ou link_maps.

3. **Logica do link**: 
   - Se `latitude` e `longitude` existem, gerar link `https://www.google.com/maps/dir/?api=1&destination={lat},{lon}`
   - Senao, usar `link_maps` diretamente
   - O clique no icone usa `e.stopPropagation()` para nao abrir a visita

4. **Importar** o icone `Navigation` (ja importado no arquivo).

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/crm/CrmVisitas.tsx` | Adicionar campos de coordenadas na query e icone de navegacao nos cards |
