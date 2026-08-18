import type { Axis } from "./axes";

export type PriceableItem = { id: number; axis: string; priceCents: number };

/** axis -> selected catalogItem id */
export type Selections = Partial<Record<Axis, number>>;

export function computeStandardPriceCents(selections: Selections, items: PriceableItem[]): number {
  const byId = new Map(items.map((i) => [i.id, i]));
  let total = 0;
  for (const itemId of Object.values(selections)) {
    if (itemId == null) continue;
    const item = byId.get(itemId);
    if (item) total += item.priceCents;
  }
  return total;
}

export function computeTotalCents(
  selections: Selections,
  premiumCents: number,
  items: PriceableItem[]
): number {
  return computeStandardPriceCents(selections, items) + premiumCents;
}

/** Price difference of switching this axis's selection to `candidateItemId`,
 *  relative to whatever is currently selected in that axis (or $0 if nothing is). */
export function computeAxisDeltaCents(
  candidateItemId: number,
  currentItemId: number | null | undefined,
  items: PriceableItem[]
): number {
  const byId = new Map(items.map((i) => [i.id, i]));
  const candidate = byId.get(candidateItemId);
  if (!candidate) return 0;
  const current = currentItemId != null ? byId.get(currentItemId) : undefined;
  return candidate.priceCents - (current?.priceCents ?? 0);
}

export function formatCents(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${dollars.toFixed(2)}`;
}

export function formatCentsDelta(cents: number): string {
  if (cents === 0) return "included";
  const sign = cents > 0 ? "+" : "-";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}
