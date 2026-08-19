export const FIELD_TYPES = ["single_select", "multi_select", "number", "text"] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  single_select: "Single option (select one)",
  multi_select: "Multiple options (select many)",
  number: "Number",
  text: "Text",
};

export function isFieldType(value: string): value is FieldType {
  return (FIELD_TYPES as readonly string[]).includes(value);
}

export function fieldHasOptions(type: string): boolean {
  return type === "single_select" || type === "multi_select";
}

/** The 6 original fields every design must answer, in canonical display
 *  order. Seeded once, never created/deleted via the admin UI, type locked
 *  to single_select. */
export const BASE_FIELD_SLUGS = [
  "size",
  "cake_type",
  "flavor",
  "filling",
  "frosting",
  "decoration",
] as const;

export type BaseFieldSlug = (typeof BASE_FIELD_SLUGS)[number];

export const BASE_FIELD_LABELS: Record<BaseFieldSlug, string> = {
  size: "Size",
  cake_type: "Cake Type",
  flavor: "Flavor",
  filling: "Filling",
  frosting: "Frosting",
  decoration: "Decoration",
};

export function isBaseFieldSlug(value: string): value is BaseFieldSlug {
  return (BASE_FIELD_SLUGS as readonly string[]).includes(value);
}

/** Sort rank for a field slug: base fields in their canonical order first,
 *  everything else (custom fields) after. */
export function baseFieldRank(slug: string): number {
  const idx = (BASE_FIELD_SLUGS as readonly string[]).indexOf(slug);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

/** The one field slug treated as "the size field" for business logic that's
 *  inherently size-specific: the gallery's price-range calculation and the
 *  order wizard's `?size=` deep-link param. The shape-diagram visual itself
 *  is opt-in per field via `fields.hasShapeDiagram`, not tied to this slug. */
export const SIZE_FIELD_SLUG: BaseFieldSlug = "size";

/** Turns a custom field's display name into a slug. Uniqueness is enforced
 *  by the DB — callers should suffix and retry on conflict. */
export function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "field";
}
