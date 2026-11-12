/** "912345678" → "912 345 678", the usual way Spanish numbers are written. */
export const formatPhone = (digits: string) => digits.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");

/** `tel:` link with the Spanish prefix, so it also works from a foreign SIM. */
export const phoneHref = (digits: string) => `tel:+34${digits}`;
