import type { Axis } from "./axes";

export type CatalogItemDTO = {
  id: number;
  axis: string;
  name: string;
  priceCents: number;
  diameterIn: string | null;
  shape: string | null;
  tiers: number | null;
  servesMin: number | null;
  servesMax: number | null;
};

export type DesignSummaryDTO = {
  id: number;
  name: string;
  description: string | null;
  chargedPriceCents: number;
  premiumCents: number;
  photoPath: string | null;
  recipe: Partial<Record<Axis, number>>;
};
