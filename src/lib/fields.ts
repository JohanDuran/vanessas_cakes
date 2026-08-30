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

/** The fields every design must answer, in canonical display order. Seeded
 *  once, never created/deleted via the admin UI, type locked to
 *  single_select. `cake_style` is further locked to an exact 3-option set
 *  (see CakeStyleKind) — the admin can edit its options' names/prices but
 *  not add, remove, or deactivate any of them. `size`'s options are scoped
 *  per cake_style kind (standard/tall/tiered) via each option's styleKind —
 *  see src/lib/cakeStyle.ts. `tier_levels`/`tier_size` used to be separate
 *  steps for the tiered path; they're retired from the flow (rows kept,
 *  is_base=false, for historical order_selections FK integrity) now that
 *  tiered presets live directly on `size` tagged styleKind="tiered". */
export const BASE_FIELD_SLUGS = [
  "cake_style",
  "size",
  "cake_type",
  "flavor",
  "filling",
  "frosting",
  "decoration",
] as const;

export type BaseFieldSlug = (typeof BASE_FIELD_SLUGS)[number];

export const BASE_FIELD_LABELS: Record<BaseFieldSlug, string> = {
  cake_style: "Cake Style",
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

/** The one "Size" field, used by every cake_style kind. Its options are
 *  scoped per style via each option's field_options.style_kind: plain molds
 *  tagged "standard"/"tall", or admin-built tier-stack presets (see
 *  tierPresets/tierPresetLevels in src/db/schema.ts) tagged "tiered". Also
 *  drives the gallery's price-range calculation and the order wizard's
 *  `?size=` deep-link param — see src/lib/cakeStyle.ts for the filtering. */
export const SIZE_FIELD_SLUG: BaseFieldSlug = "size";

/** The cake_style field: standard | tall | tiered. Drives which `size`
 *  options are shown — see src/lib/cakeStyle.ts. */
export const CAKE_STYLE_FIELD_SLUG: BaseFieldSlug = "cake_style";

/** The 3 fixed values of the cake_style field, tagged on its options via
 *  field_options.style_kind — and reused to tag `size` field options with
 *  which style they belong to (see SIZE_FIELD_SLUG above). */
export const CAKE_STYLE_KINDS = ["standard", "tall", "tiered"] as const;

export type CakeStyleKind = (typeof CAKE_STYLE_KINDS)[number];

export function isCakeStyleKind(value: string): value is CakeStyleKind {
  return (CAKE_STYLE_KINDS as readonly string[]).includes(value);
}

/** What a design row represents: `catalog` is an ordinary priced product
 *  (today's only kind, and the only one creatable via "+ New Design").
 *  `custom`/`custom_portfolio` are the two singleton quote-request flows —
 *  seeded once (see the migration that adds `designs.kind`), never
 *  created/deleted via the admin UI, and configured for fields the same way
 *  a catalog design is (see DesignForm) but with no required default values
 *  and no charged price. `custom_portfolio` is the one reached from a
 *  Portfolio photo's "Get a Quote" button — same field config mechanism,
 *  just a different reference-image UX (locked photo, no upload). */
export const DESIGN_KINDS = ["catalog", "custom", "custom_portfolio"] as const;

export type DesignKind = (typeof DESIGN_KINDS)[number];

export function isDesignKind(value: string): value is DesignKind {
  return (DESIGN_KINDS as readonly string[]).includes(value);
}

/** Valid tier counts for a tier_size preset (field_options.tier_level_count
 *  historically, tierPresets.levelCount today) — no longer tied to a
 *  standalone "number of tiers" wizard step. */
export const TIER_LEVEL_COUNTS = [2, 3, 4] as const;

export type TierLevelCount = (typeof TIER_LEVEL_COUNTS)[number];

export function isTierLevelCount(value: number): value is TierLevelCount {
  return (TIER_LEVEL_COUNTS as readonly number[]).includes(value);
}

/** How a customer prefers to be reached about their custom-cake quote request. */
export const CONTACT_PREFERENCES = ["call", "sms", "whatsapp", "email"] as const;

export type ContactPreference = (typeof CONTACT_PREFERENCES)[number];

export const CONTACT_PREFERENCE_LABELS: Record<ContactPreference, string> = {
  call: "Call me",
  sms: "Text (SMS)",
  whatsapp: "WhatsApp",
  email: "Email",
};

export function isContactPreference(value: string): value is ContactPreference {
  return (CONTACT_PREFERENCES as readonly string[]).includes(value);
}

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
