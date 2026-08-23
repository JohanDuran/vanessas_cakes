import { getHiddenOptionIds } from "./constraints";
import { buildCakeStyleContext, currentStyleKind, sizeOptionsForStyle } from "./cakeStyle";
import { SIZE_FIELD_SLUG } from "./fields";
import type { ConstraintPair } from "./constraints";
import type { DesignSummaryDTO, FieldDTO, FieldOptionDTO, TierPresetDTO } from "./order-types";

export type PriceableOption = { id: number; fieldId: number; priceCents: number };

/** A text/number field's flat surcharge, added whenever the customer answers it. */
export type PriceableField = { id: number; additionalPriceCents: number };

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

/** Sum of every answered text/number field's flat additionalPriceCents — an
 *  unanswered (empty text, absent number) field never contributes. */
function fieldSurchargeCents(answers: Answers, fields: PriceableField[]): number {
  if (fields.length === 0) return 0;
  const byId = new Map(fields.map((f) => [f.id, f.additionalPriceCents]));
  let total = 0;
  for (const [fieldIdStr, answer] of Object.entries(answers)) {
    if (answer.type === "text" && answer.value.trim() === "") continue;
    if (answer.type !== "text" && answer.type !== "number") continue;
    total += byId.get(Number(fieldIdStr)) ?? 0;
  }
  return total;
}

export function computeStandardPriceCents(
  answers: Answers,
  options: PriceableOption[],
  fields: PriceableField[] = []
): number {
  const byId = new Map(options.map((o) => [o.id, o]));
  let total = 0;
  for (const id of selectedOptionIds(answers)) {
    const opt = byId.get(id);
    if (opt) total += opt.priceCents;
  }
  return total + fieldSurchargeCents(answers, fields);
}

export function computeTotalCents(
  answers: Answers,
  premiumCents: number,
  options: PriceableOption[],
  fields: PriceableField[] = []
): number {
  return computeStandardPriceCents(answers, options, fields) + premiumCents;
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
  const sign = cents < 0 ? "-" : "+";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

/** Cheapest and priciest total for this design across every size (or, for a
 *  Tiered-styled design, every tier-size preset matching its tier count) the
 *  customer could actually pick — options excluded by a constraint against
 *  the design's other (fixed) base selections, or excluded specifically for
 *  this design, are left out of the range entirely. Custom fields never
 *  affect the range shown here, matching the base "sticker price" advertised
 *  for a design. The range always reflects the design's own default style —
 *  it does not account for a customer switching style mid-wizard if the
 *  design leaves cake_style unlocked. */
export function priceRangeForDesign(
  design: DesignSummaryDTO,
  allFields: FieldDTO[],
  options: FieldOptionDTO[],
  pairs: ConstraintPair[],
  tierPresets: TierPresetDTO[]
): { minPriceCents: number; maxPriceCents: number } {
  const rangeField = allFields.find((f) => f.slug === SIZE_FIELD_SLUG);
  const cakeStyleCtx = buildCakeStyleContext(allFields, options, tierPresets);
  const styleKind = cakeStyleCtx ? currentStyleKind(design.fieldValues, cakeStyleCtx) : undefined;

  const otherBaseFieldIds = new Set(
    allFields.filter((f) => f.isBase && f.id !== rangeField?.id).map((f) => f.id)
  );
  const optionById = new Map(options.map((o) => [o.id, o]));

  const otherAnswers: Answers = {};
  for (const [fieldIdStr, answer] of Object.entries(design.fieldValues)) {
    const fieldId = Number(fieldIdStr);
    if (otherBaseFieldIds.has(fieldId)) otherAnswers[fieldId] = answer;
  }

  const basePriceCents = Object.values(otherAnswers).reduce((sum, answer) => {
    if (answer.type !== "options") return sum;
    return sum + answer.optionIds.reduce((s, id) => s + (optionById.get(id)?.priceCents ?? 0), 0);
  }, 0);

  if (!rangeField) {
    const total = basePriceCents + design.premiumCents;
    return { minPriceCents: total, maxPriceCents: total };
  }

  const rangeAnswer = design.fieldValues[rangeField.id];
  const currentRangeOptionId = rangeAnswer?.type === "options" ? rangeAnswer.optionIds[0] : undefined;

  // the range axis is fixed (not just filtered) when this design locks it —
  // the customer never gets to change it, so there's no range to show
  if (design.lockedFieldIds.includes(rangeField.id)) {
    const fixed = currentRangeOptionId != null ? optionById.get(currentRangeOptionId) : undefined;
    const total = basePriceCents + (fixed?.priceCents ?? 0) + design.premiumCents;
    return { minPriceCents: total, maxPriceCents: total };
  }

  const hiddenIds = getHiddenOptionIds(rangeField.id, otherAnswers, pairs);
  const excludedIds = new Set(design.excludedOptionIds);
  const styleOptions = cakeStyleCtx
    ? sizeOptionsForStyle(options, cakeStyleCtx, styleKind)
    : options.filter((o) => o.fieldId === rangeField.id);
  const candidates = styleOptions.filter((o) => !hiddenIds.has(o.id) && !excludedIds.has(o.id));

  if (candidates.length === 0) {
    const fallback = currentRangeOptionId != null ? optionById.get(currentRangeOptionId) : undefined;
    const total = basePriceCents + (fallback?.priceCents ?? 0) + design.premiumCents;
    return { minPriceCents: total, maxPriceCents: total };
  }

  const totals = candidates.map((c) => basePriceCents + c.priceCents + design.premiumCents);
  return { minPriceCents: Math.min(...totals), maxPriceCents: Math.max(...totals) };
}
