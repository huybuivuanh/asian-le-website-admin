// Optional menu item numbers (`webMenuItems/{id}.itemNumber`, a whole number ≥ 1). This is
// the website's menu, separate from the POS menu (pos-admin). Shown as
// "12. Chicken Chow Mein", same as the POS — keep in sync with
// asian-le-website/lib/menuItemNumber.ts and pos-admin's src/lib/menu-item-number.ts.

type Numbered = { name: string; itemNumber?: unknown };

/** The item's number, or undefined when it has none (or the stored value isn't valid). */
export const itemNumberOf = (item: Numbered): number | undefined =>
  typeof item.itemNumber === "number" && Number.isInteger(item.itemNumber) && item.itemNumber > 0
    ? item.itemNumber
    : undefined;

/** "12. Chicken Chow Mein", or just the name when the item has no number. */
export const menuItemLabel = (item: Numbered): string => {
  const n = itemNumberOf(item);
  return n != null ? `${n}. ${item.name}` : item.name;
};

/**
 * Items whose name contains the query, or whose number starts with it ("12", "12." and
 * "#12" all find 12, 120…). An exact number match comes first; the rest keep their order.
 */
export function searchMenuItems<T extends Numbered>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const digits = /^#?\s*(\d+)\.?$/.exec(q)?.[1];
  const matches = items.filter((item) => {
    if (item.name.toLowerCase().includes(q)) return true;
    const n = itemNumberOf(item);
    return digits != null && n != null && String(n).startsWith(digits);
  });
  if (digits == null) return matches;
  const exact = Number(digits);
  return [
    ...matches.filter((item) => itemNumberOf(item) === exact),
    ...matches.filter((item) => itemNumberOf(item) !== exact),
  ];
}

/** Keeps only digits, so the field can't hold anything but a whole number. */
export const digitsOnly = (input: string): string => input.replace(/\D/g, "").slice(0, 6);

/**
 * Checks the number typed in the form ("" = no number). Returns the number (or null for
 * none), or an error message — including when another item already has it.
 */
export function parseItemNumber(
  input: string,
  items: { id?: string; name: string; itemNumber?: unknown }[],
  ownId?: string,
): { value: number | null } | { error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { value: null };
  if (!/^\d+$/.test(trimmed)) return { error: "Item number must be a whole number." };
  const value = Number(trimmed);
  if (value < 1) return { error: "Item number must be 1 or more." };
  const taken = items.find((i) => i.id !== ownId && itemNumberOf(i) === value);
  if (taken) return { error: `${value} is already used by “${taken.name}”.` };
  return { value };
}
