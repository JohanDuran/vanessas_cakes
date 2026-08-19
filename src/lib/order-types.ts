import type { FieldType } from "./fields";
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
