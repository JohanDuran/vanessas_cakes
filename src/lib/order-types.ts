import type { CakeStyleKind, FieldType, TierLevelCount } from "./fields";
import type { Answers } from "./pricing";

export type FieldDTO = {
  id: number;
  slug: string;
  name: string;
  type: FieldType;
  isBase: boolean;
  sortOrder: number;
  hasShapeDiagram: boolean;
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

export type DesignSummaryDTO = {
  id: number;
  name: string;
  description: string | null;
  chargedPriceCents: number;
  premiumCents: number;
  /** all photos, primary first, then by sort order — empty if none uploaded */
  photos: string[];
  /** default answer per field (base fields always have one; custom fields
   *  only if the admin included them in this design) */
  fieldValues: Answers;
  /** fields the customer can't change for this design — fixed at fieldValues' answer */
  lockedFieldIds: number[];
  /** options hidden from the customer for this design specifically */
  excludedOptionIds: number[];
};
