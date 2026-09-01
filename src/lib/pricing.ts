import { getHiddenOptionIds } from "./constraints";
import { buildCakeStyleContext, currentStyleKind, sizeOptionsForStyle } from "./cakeStyle";
import { SIZE_FIELD_SLUG } from "./fields";
import type { ConstraintPair } from "./constraints";
import type { DesignSummaryDTO, FieldDTO, FieldOptionDTO, TierPresetDTO } from "./order-types";

export type PriceableOption = { id: number; fieldId: number; priceCents: number };

/** A text/number/per_size field's flat surcharge, added whenever the
 *  customer answers (or, for per_size, opts into) it. */
export type PriceableField = { id: number; additionalPriceCents: number };

/** An id (a fieldId for a per_size field, or a fieldOptionId for a regular
 *  select option) -> sizeOptionId -> priceCents. Present only when the
 *  design in question has made that field/option size-varying — see
 *  DesignSummaryDTO.perSizeFieldPrices / optionSizePrices. */
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
 *  resolvePriceableFields, buildDesignPriceOverrides/db/queries.ts's DTO
 *  loaders, the only places these get populated from the DB. */
export type DesignPriceOverrides = {
  optionPriceOverrides: Record<number, number>;
  fieldPriceOverrides: Record<number, number>;
  perSizeFieldPrices: PerSizePrices;
  optionSizePrices: PerSizePrices;
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
 *  this flat value entirely — see resolveFieldPriceCents. */
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
 *  design_option_prices/design_field_prices/design_field_size_prices/
 *  design_option_size_prices tables down to `designId` — for call sites
 *  (checkout re-pricing, saveDesign) that only ever need one design at a
 *  time rather than db/queries.ts's grouped-by-every-design version used by
 *  loadOrderData. */
export function buildDesignPriceOverrides(
  designId: number,
  optionPriceRows: { designId: number; fieldOptionId: number; priceCents: number }[],
  fieldPriceRows: { designId: number; fieldId: number; priceCents: number }[],
  fieldSizePriceRows: { designId: number; fieldId: number; sizeOptionId: number; priceCents: number }[],
  optionSizePriceRows: { designId: number; fieldOptionId: number; sizeOptionId: number; priceCents: number }[] = []
): DesignPriceOverrides {
  const optionPriceOverrides: Record<number, number> = {};
  for (const r of optionPriceRows) if (r.designId === designId) optionPriceOverrides[r.fieldOptionId] = r.priceCents;

  const fieldPriceOverrides: Record<number, number> = {};
  for (const r of fieldPriceRows) if (r.designId === designId) fieldPriceOverrides[r.fieldId] = r.priceCents;

  const perSizeFieldPrices: PerSizePrices = {};
  for (const r of fieldSizePriceRows) {
    if (r.designId !== designId) continue;
    const bySize = perSizeFieldPrices[r.fieldId] ?? {};
    bySize[r.sizeOptionId] = r.priceCents;
    perSizeFieldPrices[r.fieldId] = bySize;
  }

  const optionSizePrices: PerSizePrices = {};
  for (const r of optionSizePriceRows) {
    if (r.designId !== designId) continue;
    const bySize = optionSizePrices[r.fieldOptionId] ?? {};
    bySize[r.sizeOptionId] = r.priceCents;
    optionSizePrices[r.fieldOptionId] = bySize;
  }

  return { optionPriceOverrides, fieldPriceOverrides, perSizeFieldPrices, optionSizePrices };
}

function selectedOptionIds(answers: Answers): number[] {
  const ids: number[] = [];
  for (const answer of Object.values(answers)) {
    if (answer.type === "options") ids.push(...answer.optionIds);
  }
  return ids;
}

/** One field's flat price — or, for a per_size field this design has made
 *  size-varying (an entry in `perSizeFieldPrices`), its price at
 *  `currentSizeOptionId` (0 if that specific size has no price set yet).
 *  Exposed for callers (e.g. the checkout snapshot writer) that need a
 *  single field's price outside a full answers pass. */
export function resolveFieldPriceCents(
  fieldId: number,
  fields: PriceableField[],
  perSizeFieldPrices?: PerSizePrices,
  currentSizeOptionId?: number
): number {
  const sizePrices = perSizeFieldPrices?.[fieldId];
  if (sizePrices) return currentSizeOptionId != null ? (sizePrices[currentSizeOptionId] ?? 0) : 0;
  return fields.find((f) => f.id === fieldId)?.additionalPriceCents ?? 0;
}

/** One select option's flat price — or, for an option this design has made
 *  size-varying (an entry in `optionSizePrices`), its price at
 *  `currentSizeOptionId` (0 if that size has no price set yet). Undefined
 *  means the option doesn't exist in `options` and has no size-price entry
 *  either — an invalid id. Exposed (unlike its by-Map internal use below)
 *  for callers that need a single option's price outside a full answers pass. */
export function resolveOptionPriceCents(
  optionId: number,
  options: PriceableOption[],
  optionSizePrices?: PerSizePrices,
  currentSizeOptionId?: number
): number | undefined {
  return resolveOptionPriceCentsById(optionId, new Map(options.map((o) => [o.id, o])), optionSizePrices, currentSizeOptionId);
}

function resolveOptionPriceCentsById(
  optionId: number,
  optionsById: Map<number, PriceableOption>,
  optionSizePrices?: PerSizePrices,
  currentSizeOptionId?: number
): number | undefined {
  const sizePrices = optionSizePrices?.[optionId];
  if (sizePrices) return currentSizeOptionId != null ? (sizePrices[currentSizeOptionId] ?? 0) : 0;
  return optionsById.get(optionId)?.priceCents;
}

/** Sum of every answered text/number field's flat additionalPriceCents, plus
 *  every opted-into per_size field's price (flat, or size-resolved — see
 *  resolveFieldPriceCents). An unanswered (empty text, absent number,
 *  un-toggled) field never contributes. */
function fieldSurchargeCents(
  answers: Answers,
  fields: PriceableField[],
  perSizeFieldPrices?: PerSizePrices,
  currentSizeOptionId?: number
): number {
  if (fields.length === 0) return 0;
  let total = 0;
  for (const [fieldIdStr, answer] of Object.entries(answers)) {
    if (answer.type === "text" && answer.value.trim() === "") continue;
    if (answer.type === "toggle" && !answer.value) continue;
    if (answer.type !== "text" && answer.type !== "number" && answer.type !== "toggle") continue;
    total += resolveFieldPriceCents(Number(fieldIdStr), fields, perSizeFieldPrices, currentSizeOptionId);
  }
  return total;
}

/** A design's total price for the given answers — every selected option
 *  priced (flat, or per the design's currently-selected size if that
 *  option's field was made size-varying), plus every answered/opted-into
 *  text/number/per_size field's surcharge. This *is* the design's price —
 *  there's no separate "standard price" or premium on top of it. */
export function computeTotalCents(
  answers: Answers,
  options: PriceableOption[],
  fields: PriceableField[] = [],
  perSizeFieldPrices?: PerSizePrices,
  optionSizePrices?: PerSizePrices,
  currentSizeOptionId?: number
): number {
  const byId = new Map(options.map((o) => [o.id, o]));
  let total = 0;
  for (const id of selectedOptionIds(answers)) {
    total += resolveOptionPriceCentsById(id, byId, optionSizePrices, currentSizeOptionId) ?? 0;
  }
  return total + fieldSurchargeCents(answers, fields, perSizeFieldPrices, currentSizeOptionId);
}

/** Price difference of switching to `candidateOptionId` within a single_select
 *  field, relative to whatever's currently selected there (or $0 if nothing is). */
export function computeOptionDeltaCents(
  candidateOptionId: number,
  currentOptionId: number | null | undefined,
  options: PriceableOption[],
  optionSizePrices?: PerSizePrices,
  currentSizeOptionId?: number
): number {
  const byId = new Map(options.map((o) => [o.id, o]));
  const candidatePrice = resolveOptionPriceCentsById(candidateOptionId, byId, optionSizePrices, currentSizeOptionId);
  if (candidatePrice == null) return 0;
  const currentPrice =
    currentOptionId != null
      ? (resolveOptionPriceCentsById(currentOptionId, byId, optionSizePrices, currentSizeOptionId) ?? 0)
      : 0;
  return candidatePrice - currentPrice;
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
 *  design leaves cake_style unlocked.
 *
 *  Simplification: if one of the "other base fields" is itself size-varying
 *  for this design (see optionSizePrices), its default's price is still
 *  taken flat (not resolved per candidate size) — a fully accurate range
 *  would need a different "other fields" total per candidate size. This
 *  only affects the advertised gallery range, never the actual checkout
 *  price, which always resolves per-size correctly (see computeTotalCents). */
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
    return { minPriceCents: basePriceCents, maxPriceCents: basePriceCents };
  }

  const rangeAnswer = design.fieldValues[rangeField.id];
  const currentRangeOptionId = rangeAnswer?.type === "options" ? rangeAnswer.optionIds[0] : undefined;

  // the range axis is fixed (not just filtered) when this design locks it —
  // the customer never gets to change it, so there's no range to show
  if (design.lockedFieldIds.includes(rangeField.id)) {
    const total = basePriceCents + (resolvedPriceById.get(currentRangeOptionId ?? -1) ?? 0);
    return { minPriceCents: total, maxPriceCents: total };
  }

  const hiddenIds = getHiddenOptionIds(rangeField.id, otherAnswers, pairs);
  const excludedIds = new Set(design.excludedOptionIds);
  const styleOptions = cakeStyleCtx
    ? sizeOptionsForStyle(options, cakeStyleCtx, styleKind)
    : options.filter((o) => o.fieldId === rangeField.id);
  const candidates = styleOptions.filter((o) => !hiddenIds.has(o.id) && !excludedIds.has(o.id));

  if (candidates.length === 0) {
    const total = basePriceCents + (resolvedPriceById.get(currentRangeOptionId ?? -1) ?? 0);
    return { minPriceCents: total, maxPriceCents: total };
  }

  const totals = candidates.map((c) => basePriceCents + (resolvedPriceById.get(c.id) ?? 0));
  return { minPriceCents: Math.min(...totals), maxPriceCents: Math.max(...totals) };
}
