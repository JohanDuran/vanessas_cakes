import type { CakeStyleKind, DesignKind, FieldType, TierLevelCount } from "./fields";
import type { Answers } from "./pricing";

export type FieldDTO = {
  id: number;
  slug: string;
  name: string;
  type: FieldType;
  isBase: boolean;
  sortOrder: number;
  hasShapeDiagram: boolean;
  /** text/number fields only: customer must answer before continuing/submitting */
  required: boolean;
  /** text/number fields only: flat surcharge added when the customer answers this field */
  additionalPriceCents: number;
};

export type FieldOptionDimensionsDTO = {
  diameterIn: string | null;
  shape: string | null;
  tiers: number | null;
  servesMin: number | null;
  servesMax: number | null;
};

export type FieldOptionDTO = {
  id: number;
  fieldId: number;
  name: string;
  priceCents: number;
  /** bolt-on visual metadata — only present when the owning field has hasShapeDiagram=true */
  dimensions: FieldOptionDimensionsDTO | null;
  /** set only for the cake_style field's 3 fixed options */
  styleKind: CakeStyleKind | null;
  /** set only for the tier_levels field's 3 fixed options */
  tierLevelCount: TierLevelCount | null;
};

/** One level of a tier preset's mold stack, position 1 = base/bottom (widest). */
export type TierPresetLevelDTO = {
  position: number;
  /** references a `size`-field FieldOptionDTO.id */
  moldOptionId: number;
  moldName: string;
  diameterIn: string | null;
  shape: string | null;
  servesMin: number | null;
  servesMax: number | null;
};

/** An admin-built named preset in the `tier_size` field — e.g. "Large" for a
 *  4-tier cake — with its ordered mold stack, base (position 1) to top. */
export type TierPresetDTO = {
  /** the tier_size field's option id that IS this preset */
  fieldOptionId: number;
  levelCount: number;
  levels: TierPresetLevelDTO[];
};

/** An admin-defined tag like "Tall Cakes" or "Wedding Cakes" — never shown on
 *  its own, only used as a filter chip above the design picker/gallery. */
export type CategoryDTO = {
  id: number;
  name: string;
};

export type DesignSummaryDTO = {
  id: number;
  name: string;
  description: string | null;
  /** catalog | custom | custom_portfolio — see DesignKind. Only catalog
   *  designs are browsable products; the other two are the singleton
   *  quote-request flows. */
  kind: DesignKind;
  chargedPriceCents: number;
  premiumCents: number;
  /** all photos, primary first, then by sort order — empty if none uploaded */
  photos: string[];
  /** default answer per field (base fields always have one; custom fields
   *  only if the admin included them in this design) */
  fieldValues: Answers;
  /** fields the customer can't change for this design — fixed at fieldValues' answer */
  lockedFieldIds: number[];
  /** every field this design actually uses — base fields always, custom fields
   *  the admin included (whether or not a default value was given). Distinct
   *  from `fieldValues`' keys, since a custom field can be included with no
   *  default answer at all. */
  includedFieldIds: number[];
  /** options hidden from the customer for this design specifically */
  excludedOptionIds: number[];
  /** cake categories this design belongs to — empty if the admin picked none */
  categoryIds: number[];
  /** this design's own price override per select-type option (fieldOptionId
   *  -> priceCents) — absent entries fall back to the option's catalog
   *  price. See resolvePriceableOptions in lib/pricing.ts. */
  optionPriceOverrides: Record<number, number>;
  /** this design's own flat-price override per text/number/per_size field
   *  (fieldId -> priceCents) — absent entries fall back to the field's
   *  catalog additionalPriceCents. Unused for a per_size field that has an
   *  entry in perSizeFieldPrices instead. See resolvePriceableFields. */
  fieldPriceOverrides: Record<number, number>;
  /** per_size fields this design has made size-varying, and their price at
   *  each size option: fieldId -> sizeOptionId -> priceCents. A per_size
   *  field with no entry here is flat-priced for this design instead (see
   *  fieldPriceOverrides). */
  perSizeFieldPrices: Record<number, Record<number, number>>;
};
