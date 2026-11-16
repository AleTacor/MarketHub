const euros = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

/** 1250 → "12,50 €" (the space before € is a non-breaking one). */
export const formatPrice = (cents: number) => euros.format(cents / 100);

/** Value for the price field when editing: 1250 → "12,50", 300 → "3", null → "". */
export const priceInputValue = (cents: number | null) =>
  cents === null ? "" : cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace(".", ",");
