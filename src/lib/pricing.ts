import { getHiddenOptionIds } from "./constraints";
import { buildCakeStyleContext, currentStyleKind, sizeOptionsForStyle } from "./cakeStyle";
import { SIZE_FIELD_SLUG } from "./fields";
import type { ConstraintPair } from "./constraints";
import type { DesignSummaryDTO, FieldDTO, FieldOptionDTO, TierPresetDTO } from "./order-types";

export type PriceableOption = { id: number; fieldId: number; priceCents: number };

/** A text/number/per_size field's flat surcharge, added whenever the
 *  customer answers (or, for per_size, opts into) it. */
export type PriceableField = { id: number; additionalPriceCents: number };

/** fieldId -> sizeOptionId -> priceCents — a per_size field's price at each
 *  size, for one particular design. A field only appears here when that
 *  design has made it size-varying (see resolvePerSizePrices); otherwise its
 *  price comes from the flat PriceableField list like any other field. */
export type PerSizePrices = Record<number, Record<number, number>>;

/** A design's (or the wizard's current) answer for one field, keyed by fieldId. */
export type FieldAnswer =
  | { type: "options"; optionIds: number[] } // single_select (length 1) or multi_select (0..N)
  | { type: "text"; value: string }
  | { type: "number"; value: number }
  | { type: "toggle"; value: boolean }; // per_size fields: a plain opt-in/opt-out

/** fieldId -> answer */
export type Answers = Record<number, FieldAnswer>;

/** A design's per-field/option price overrides — absent entries fall back to
 *  the catalog price everywhere below. See resolvePriceableOptions,
 *  resolvePriceableFields, resolvePerSizePrices in db/queries.ts's DTO
 *  loaders, the only place these get populated from the DB. */
export type DesignPriceOverrides = {
  optionPriceOverrides: Record<number, number>;
  fieldPriceOverrides: Record<number, number>;
  perSizeFieldPrices: PerSizePrices;
};

/** Folds this design's per-option price overrides into a flat priceable
 *  list — every consumer of `options` below should pass the result of this,
 *  never the raw catalog list, so a design's own prices are always used. */
export function resolvePriceableOptions(
  overrides: Pick<DesignPriceOverrides, "optionPriceOverrides">,
  options: { id: number; fieldId: number; priceCents: number }[]
): PriceableOption[] {
  return options.map((o) => ({
    id: o.id,
    fieldId: o.fieldId,
    priceCents: overrides.optionPriceOverrides[o.id] ?? o.priceCents,
  }));
}

/** Same as resolvePriceableOptions, for text/number/per_size fields' flat
 *  surcharge. A per_size field with an entry in perSizeFieldPrices ignores
 *  this flat value entirely — see fieldSurchargeCents. */
export function resolvePriceableFields(
  overrides: Pick<DesignPriceOverrides, "fieldPriceOverrides">,
  fields: { id: number; additionalPriceCents: number }[]
): PriceableField[] {
  return fields.map((f) => ({
    id: f.id,
    additionalPriceCents: overrides.fieldPriceOverrides[f.id] ?? f.additionalPriceCents,
  }));
}

/** Builds one design's DesignPriceOverrides by filtering the full
 *  design_option_prices/design_field_prices/design_field_size_prices tables
 *  down to `designId` — for call sites (checkout re-pricing, saveDesign)
 *  that only ever need one design at a time rather than db/queries.ts's
 *  grouped-by-every-design version used by loadOrderData. */
export function buildDesignPriceOverrides(
  designId: number,
  optionPriceRows: { designId: number; fieldOptionId: number; priceCents: number }[],
  fieldPriceRows: { designId: number; fieldId: number; priceCents: number }[],
  sizePriceRows: { designId: number; fieldId: number; sizeOptionId: number; priceCents: number }[]
): DesignPriceOverrides {
  const optionPriceOverrides: Record<number, number> = {};
  for (const r of optionPriceRows) if (r.designId === designId) optionPriceOverrides[r.fieldOptionId] = r.priceCents;

  const fieldPriceOverrides: Record<number, number> = {};
  for (const r of fieldPriceRows) if (r.designId === designId) fieldPriceOverrides[r.fieldId] = r.priceCents;

  const perSizeFieldPrices: PerSizePrices = {};
  for (const r of sizePriceRows) {
    if (r.designId !== designId) continue;
    const bySize = perSizeFieldPrices[r.fieldId] ?? {};
    bySize[r.sizeOptionId] = r.priceCents;
    perSizeFieldPrices[r.fieldId] = bySize;
  }

  return { optionPriceOverrides, fieldPriceOverrides, perSizeFieldPrices };
}

function selectedOptionIds(answers: Answers): number[] {
  const ids: number[] = [];
  for (const answer of Object.values(answers)) {
    if (answer.type === "options") ids.push(...answer.optionIds);
  }
  return ids;
}

/** One field's flat price — or, for a per_size field this design has made
 *  size-varying (an entry in `perSizePrices`), its price at
 *  `currentSizeOptionId` (0 if that specific size has no price set yet).
 *  Exposed for callers (e.g. the checkout snapshot writer) that need a
 *  single field's price outside a full answers pass. */
export function resolveFieldPriceCents(
  fieldId: number,
  fields: PriceableField[],
  perSizePrices?: PerSizePrices,
  currentSizeOptionId?: number
): number {
  const sizePrices = perSizePrices?.[fieldId];
  if (sizePrices) return currentSizeOptionId != null ? (sizePrices[currentSizeOptionId] ?? 0) : 0;
  return fields.find((f) => f.id === fieldId)?.additionalPriceCents ?? 0;
}

/** Sum of every answered text/number field's flat additionalPriceCents, plus
 *  every opted-into per_size field's price (flat, or size-resolved — see
 *  resolveFieldPriceCents). An unanswered (empty text, absent number,
 *  un-toggled) field never contributes. */
function fieldSurchargeCents(
  answers: Answers,
  fields: PriceableField[],
  perSizePrices?: PerSizePrices,
  currentSizeOptionId?: number
): number {
  if (fields.length === 0) return 0;
  let total = 0;
  for (const [fieldIdStr, answer] of Object.entries(answers)) {
    if (answer.type === "text" && answer.value.trim() === "") continue;
    if (answer.type === "toggle" && !answer.value) continue;
    if (answer.type !== "text" && answer.type !== "number" && answer.type !== "toggle") continue;
    total += resolveFieldPriceCents(Number(fieldIdStr), fields, perSizePrices, currentSizeOptionId);
  }
  return total;
}

export function computeStandardPriceCents(
  answers: Answers,
  options: PriceableOption[],
  fields: PriceableField[] = [],
  perSizePrices?: PerSizePrices,
  currentSizeOptionId?: number
): number {
  const byId = new Map(options.map((o) => [o.id, o]));
  let total = 0;
  for (const id of selectedOptionIds(answers)) {
    const opt = byId.get(id);
    if (opt) total += opt.priceCents;
  }
  return total + fieldSurchargeCents(answers, fields, perSizePrices, currentSizeOptionId);
}

export function computeTotalCents(
  answers: Answers,
  premiumCents: number,
  options: PriceableOption[],
  fields: PriceableField[] = [],
  perSizePrices?: PerSizePrices,
  currentSizeOptionId?: number
): number {
  return computeStandardPriceCents(answers, options, fields, perSizePrices, currentSizeOptionId) + premiumCents;
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
  // this design's own prices, not the raw catalog ones — see resolvePriceableOptions
  const resolvedPriceById = new Map(resolvePriceableOptions(design, options).map((o) => [o.id, o.priceCents]));

  const otherAnswers: Answers = {};
  for (const [fieldIdStr, answer] of Object.entries(design.fieldValues)) {
    const fieldId = Number(fieldIdStr);
    if (otherBaseFieldIds.has(fieldId)) otherAnswers[fieldId] = answer;
  }

  const basePriceCents = Object.values(otherAnswers).reduce((sum, answer) => {
    if (answer.type !== "options") return sum;
    return sum + answer.optionIds.reduce((s, id) => s + (resolvedPriceById.get(id) ?? 0), 0);
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
    const total = basePriceCents + (resolvedPriceById.get(currentRangeOptionId ?? -1) ?? 0) + design.premiumCents;
    return { minPriceCents: total, maxPriceCents: total };
  }

  const hiddenIds = getHiddenOptionIds(rangeField.id, otherAnswers, pairs);
  const excludedIds = new Set(design.excludedOptionIds);
  const styleOptions = cakeStyleCtx
    ? sizeOptionsForStyle(options, cakeStyleCtx, styleKind)
    : options.filter((o) => o.fieldId === rangeField.id);
  const candidates = styleOptions.filter((o) => !hiddenIds.has(o.id) && !excludedIds.has(o.id));

  if (candidates.length === 0) {
    const total = basePriceCents + (resolvedPriceById.get(currentRangeOptionId ?? -1) ?? 0) + design.premiumCents;
    return { minPriceCents: total, maxPriceCents: total };
  }

  const totals = candidates.map((c) => basePriceCents + (resolvedPriceById.get(c.id) ?? 0) + design.premiumCents);
  return { minPriceCents: Math.min(...totals), maxPriceCents: Math.max(...totals) };
}
