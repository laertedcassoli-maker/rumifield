
## Bloquear exclusao de audios em visita concluida

### Alteracao

Passar o status da visita como prop para o `VisitAudioList` e esconder o botao "Apagar" quando a visita estiver concluida (ou cancelada).

### Arquivo: `src/components/crm/VisitAudioList.tsx`

- Adicionar prop `visitStatus?: string` na interface `Props`
- Derivar `readonly = visitStatus === 'concluida' || visitStatus === 'cancelada'`
- No botao "Apagar": renderizar apenas se `!readonly`
- Tambem esconder botoes "Transcrever" e "Resumir" em modo readonly (opcional, mas faz sentido manter consistencia -- ou manter apenas esses dois habilitados pois sao nao-destrutivos)

### Arquivo: `src/pages/crm/CrmVisitaExecucao.tsx`

- Passar `visitStatus={visit?.status}` para o componente `VisitAudioList`

### Decisao sobre Transcrever/Resumir

Transcrever e Resumir sao operacoes nao-destrutivas que agregam valor. Serao mantidos habilitados mesmo em visitas concluidas. Apenas o botao "Apagar" sera removido.
