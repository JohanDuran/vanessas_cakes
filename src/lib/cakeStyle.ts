import type { Answers } from "./pricing";
import type { FieldDTO, FieldOptionDTO, TierPresetDTO } from "./order-types";
import { CAKE_STYLE_FIELD_SLUG, SIZE_FIELD_SLUG, type CakeStyleKind } from "./fields";

export type CakeStyleContext = {
  styleFieldId: number;
  sizeFieldId: number;
  styleKindByOptionId: Map<number, CakeStyleKind>;
  presetsByOptionId: Map<number, TierPresetDTO>;
};

/** Builds lookup context for the cake-style rules, or null if either of the
 *  2 style-related base fields is missing (shouldn't happen post-seed —
 *  callers should treat null as "cake-style logic is a no-op"). */
export function buildCakeStyleContext(
  fields: FieldDTO[],
  options: FieldOptionDTO[],
  tierPresets: TierPresetDTO[]
): CakeStyleContext | null {
  const styleField = fields.find((f) => f.slug === CAKE_STYLE_FIELD_SLUG);
  const sizeField = fields.find((f) => f.slug === SIZE_FIELD_SLUG);
  if (!styleField || !sizeField) return null;

  const styleKindByOptionId = new Map<number, CakeStyleKind>();
  for (const opt of options) {
    if (opt.styleKind) styleKindByOptionId.set(opt.id, opt.styleKind);
  }

  return {
    styleFieldId: styleField.id,
    sizeFieldId: sizeField.id,
    styleKindByOptionId,
    presetsByOptionId: new Map(tierPresets.map((p) => [p.fieldOptionId, p])),
  };
}

function selectedOptionId(answers: Answers, fieldId: number): number | undefined {
  const answer = answers[fieldId];
  if (!answer || answer.type !== "options") return undefined;
  return answer.optionIds[0];
}

/** The live style kind, or undefined if unanswered / not a recognized style option. */
export function currentStyleKind(answers: Answers, ctx: CakeStyleContext): CakeStyleKind | undefined {
  const optionId = selectedOptionId(answers, ctx.styleFieldId);
  return optionId != null ? ctx.styleKindByOptionId.get(optionId) : undefined;
}

/** `size` field options belonging to the given style — plain molds for
 *  standard/tall, tier-stack presets for tiered. Empty until a style is
 *  chosen. This is the one filter every consumer (order wizard, design
 *  form, price-range calc) uses to scope Size to the live Cake Style. */
export function sizeOptionsForStyle(
  options: FieldOptionDTO[],
  ctx: CakeStyleContext,
  styleKind: CakeStyleKind | undefined
): FieldOptionDTO[] {
  if (!styleKind) return [];
  return options.filter(
    (o) => o.fieldId === ctx.sizeFieldId && ctx.styleKindByOptionId.get(o.id) === styleKind
  );
}

/** Drops the `size` answer once it no longer belongs to the live style —
 *  e.g. switching Standard -> Tall, or -> Tiered. Call this after
 *  resolveAnswers() at every point an answer changes, so the wizard never
 *  carries forward a size pick that belongs to a different style. */
export function applyCakeStyleRules(answers: Answers, ctx: CakeStyleContext): Answers {
  const styleKind = currentStyleKind(answers, ctx);
  const sizeAnswer = answers[ctx.sizeFieldId];
  if (!sizeAnswer || sizeAnswer.type !== "options") return answers;

  const optionId = sizeAnswer.optionIds[0];
  const optionStyle = optionId != null ? ctx.styleKindByOptionId.get(optionId) : undefined;
  if (optionStyle === styleKind) return answers;

  const next = { ...answers };
  delete next[ctx.sizeFieldId];
  return next;
}

export type AtomicMold = { id: number; sortOrder: number };

/** True if chosenIds (ordered base->top, i.e. position 1..N) form a
 *  contiguous, strictly-descending-size run within atomicMolds — no skipped
 *  size level between consecutive tiers, and each tier strictly smaller than
 *  the one below it. Molds are ranked by sortOrder ascending = smallest to
 *  largest, matching the `size` field's seeded convention. */
export function isValidMoldStack(chosenIds: number[], atomicMolds: AtomicMold[]): boolean {
  if (chosenIds.length < 2) return false;
  if (new Set(chosenIds).size !== chosenIds.length) return false;

  const orderedIds = [...atomicMolds].sort((a, b) => a.sortOrder - b.sortOrder).map((m) => m.id);
  const indexById = new Map(orderedIds.map((id, idx) => [id, idx]));

  const indices: number[] = [];
  for (const id of chosenIds) {
    const idx = indexById.get(id);
    if (idx == null) return false;
    indices.push(idx);
  }

  for (let i = 1; i < indices.length; i++) {
    if (indices[i] >= indices[i - 1]) return false; // must strictly shrink going up
  }

  const sorted = [...indices].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return false; // no skipped size level
  }

  return true;
}

/** Sum of each level's mold serves range — the preset's total servings, or
 *  null bounds if any level is missing serves data. */
export function totalServesForPreset(preset: TierPresetDTO): { min: number | null; max: number | null } {
  let min = 0;
  let max = 0;
  for (const level of preset.levels) {
    if (level.servesMin == null || level.servesMax == null) return { min: null, max: null };
    min += level.servesMin;
    max += level.servesMax;
  }
  return { min, max };
}
