
Pequena mudança de UX: após finalizar um chamado em `FinalizarChamadoDialog`, navegar para `/chamados`.

## Plano

### `src/components/chamados/FinalizarChamadoDialog.tsx`
- Importar `useNavigate` de `react-router-dom`.
- No `onSuccess` da `finalizeMutation`, após o `toast` e invalidações, chamar `navigate('/chamados')`.

Sem outras mudanças.
