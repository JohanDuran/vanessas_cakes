export type PriceableOption = { id: number; fieldId: number; priceCents: number };

/** A design's (or the wizard's current) answer for one field, keyed by fieldId. */
export type FieldAnswer =
  | { type: "options"; optionIds: number[] } // single_select (length 1) or multi_select (0..N)
  | { type: "text"; value: string }
  | { type: "number"; value: number };

/** fieldId -> answer */
export type Answers = Record<number, FieldAnswer>;

function selectedOptionIds(answers: Answers): number[] {
  const ids: number[] = [];
  for (const answer of Object.values(answers)) {
    if (answer.type === "options") ids.push(...answer.optionIds);
  }
  return ids;
}

export function computeStandardPriceCents(answers: Answers, options: PriceableOption[]): number {
  const byId = new Map(options.map((o) => [o.id, o]));
  let total = 0;
  for (const id of selectedOptionIds(answers)) {
    const opt = byId.get(id);
    if (opt) total += opt.priceCents;
  }
  return total;
}

export function computeTotalCents(
  answers: Answers,
  premiumCents: number,
  options: PriceableOption[]
): number {
  return computeStandardPriceCents(answers, options) + premiumCents;
}

/** Price difference of switching to `candidateOptionId` within a single_select
 *  field, relative to whatever's currently selected there (or $0 if nothing is). */
export function computeOptionDeltaCents(
  candidateOptionId: number,
  currentOptionId: number | null | undefined,
  options: PriceableOption[]
): number {
  const byId = new Map(options.map((o) => [o.id, o]));
  const candidate = byId.get(candidateOptionId);
  if (!candidate) return 0;
  const current = currentOptionId != null ? byId.get(currentOptionId) : undefined;
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
