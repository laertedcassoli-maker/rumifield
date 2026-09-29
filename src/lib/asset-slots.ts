// Slot de ativo: um workshop_item_id OU um DD de pistola manual ("dd:<valor>").
const PREFIX = 'dd:';

export const isManualDD = (slot?: string | null) => !!slot && slot.startsWith(PREFIX);
export const toManualDD = (value: string) => `${PREFIX}${value}`;
export const fromManualDD = (slot: string) => slot.slice(PREFIX.length);

/** Slot preenchido: lacre escolhido ou DD com texto. */
export const isFilledSlot = (slot?: string | null) =>
  !!slot && (isManualDD(slot) ? fromManualDD(slot).trim().length > 0 : true);

export const splitSlots = (slots: string[]) => {
  const filled = slots.filter(isFilledSlot);
  return {
    ids: filled.filter((s) => !isManualDD(s)),
    dds: filled.filter(isManualDD).map((s) => fromManualDD(s).trim()),
  };
};

/** Converte linhas de pedido_item_assets de volta em slots. */
export const rowsToSlots = (rows: { workshop_item_id?: string | null; dd_pistola_manual?: string | null }[]) =>
  rows
    .map((r) => (r.workshop_item_id ? r.workshop_item_id : r.dd_pistola_manual ? toManualDD(r.dd_pistola_manual) : ''))
    .filter(Boolean);
