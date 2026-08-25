import { sql } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// One unified system for everything a customer answers when ordering a cake —
// the 6 original "base" fields (size, cake type, flavor, filling, frosting,
// decoration) and any admin-defined "custom" fields are the same kind of row,
// distinguished only by `isBase`. See src/lib/fields.ts for the fixed set of
// base slugs and the shared FieldType union — SQLite has no native enum,
// validity of `type`/`slug` is enforced at the app layer (zod).

export const fields = sqliteTable("fields", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull(), // single_select | multi_select | number | text
  isBase: integer("is_base", { mode: "boolean" }).notNull().default(false),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  // opt-in: this field's options get the shape/dimension diagram visual in
  // the order wizard, and the matching editable columns in the admin
  // catalog table — independent of which field this is (see field_option_dimensions)
  hasShapeDiagram: integer("has_shape_diagram", { mode: "boolean" }).notNull().default(false),
  // text/number fields only: customer must answer before continuing/submitting.
  // Admin's own design-editor form is intentionally exempt — see DesignForm.
  required: integer("required", { mode: "boolean" }).notNull().default(false),
  // text/number fields only: flat surcharge added to the order total whenever
  // the customer actually answers this field (see src/lib/pricing.ts)
  additionalPriceCents: integer("additional_price_cents").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now','subsec') * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch('now','subsec') * 1000)`),
});

export const fieldOptions = sqliteTable("field_options", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fieldId: integer("field_id")
    .notNull()
    .references(() => fields.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  priceCents: integer("price_cents").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  // Set for the 3 fixed cake_style options (standard | tall | tiered, not
  // editable via the generic option form) AND reused to tag every `size`
  // field option with which style it belongs to — standard/tall are plain
  // molds, tiered options are stack presets (see tierPresets/tierPresetLevels
  // below). See src/lib/fields.ts CakeStyleKind and src/lib/cakeStyle.ts.
  styleKind: text("style_kind"),
  // Historical: only ever set for the old tier_levels field's 3 fixed
  // options (now retired from the flow — see BASE_FIELD_SLUGS in
  // src/lib/fields.ts). tierPresets.levelCount is the source of truth today.
  tierLevelCount: integer("tier_level_count"),

  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now','subsec') * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch('now','subsec') * 1000)`),
});

/** Bolt-on visual/dimension metadata for a field_option — only present when
 *  the owning field has hasShapeDiagram=true and at least one value was set.
 *  Powers ShapeDiagram in the order wizard and the admin catalog table. */
export const fieldOptionDimensions = sqliteTable("field_option_dimensions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fieldOptionId: integer("field_option_id")
    .notNull()
    .unique()
    .references(() => fieldOptions.id, { onDelete: "cascade" }),
  diameterIn: text("diameter_in"),
  shape: text("shape"), // round | square | sheet
  tiers: integer("tiers"),
  servesMin: integer("serves_min"),
  servesMax: integer("serves_max"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now','subsec') * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch('now','subsec') * 1000)`),
});

/** A named, admin-built preset in the `tier_size` field — e.g. "Large" for a
 *  4-tier cake. 1:1 with the field_options row that IS the preset; name and
 *  flat priceCents live there, same additive pricing model as every other
 *  option (never derived from the constituent molds' prices). */
export const tierPresets = sqliteTable("tier_presets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fieldOptionId: integer("field_option_id")
    .notNull()
    .unique()
    .references(() => fieldOptions.id, { onDelete: "cascade" }),
  levelCount: integer("level_count").notNull(), // 2 | 3 | 4, denormalized for fast filtering
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now','subsec') * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch('now','subsec') * 1000)`),
});

/** One level of a tier preset's mold stack, position 1 = base/bottom (widest)
 *  up to position levelCount = top (narrowest). moldOptionId always points at
 *  an option in the `size` field — that field stays 100% atomic molds. */
export const tierPresetLevels = sqliteTable(
  "tier_preset_levels",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tierPresetId: integer("tier_preset_id")
      .notNull()
      .references(() => tierPresets.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    moldOptionId: integer("mold_option_id")
      .notNull()
      .references(() => fieldOptions.id, { onDelete: "restrict" }),
  },
  (t) => [uniqueIndex("tier_preset_levels_preset_position_idx").on(t.tierPresetId, t.position)]
);

/** An admin-defined tag like "Tall Cakes" or "Wedding Cakes" — never shown to
 *  customers by itself, but powers the category filter chips shown above the
 *  design picker/gallery (see design_categories below). */
export const cakeCategories = sqliteTable("cake_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now','subsec') * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch('now','subsec') * 1000)`),
});

export const designs = sqliteTable("designs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  chargedPriceCents: integer("charged_price_cents").notNull(),
  // server-computed: chargedPriceCents - sum(standard prices of the design's field values)
  premiumCents: integer("premium_cents").notNull().default(0),
  published: integer("published", { mode: "boolean" }).notNull().default(false),
  // admin-curated pick for the homepage hero carousel — never automatic, so
  // the homepage only ever shows cakes the admin explicitly chose to feature
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  featuredSortOrder: integer("featured_sort_order").notNull().default(0),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now','subsec') * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch('now','subsec') * 1000)`),
});

export const designPhotos = sqliteTable("design_photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  designId: integer("design_id")
    .notNull()
    .references(() => designs.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now','subsec') * 1000)`),
});

/** A design's default answer for a field — every base field has exactly one
 *  row (required); a custom field has row(s) only if the admin included it
 *  in this design (inclusion *is* having a value row here). Multi-select
 *  fields can have several rows (one per chosen default option). */
export const designFieldValues = sqliteTable(
  "design_field_values",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    designId: integer("design_id")
      .notNull()
      .references(() => designs.id, { onDelete: "cascade" }),
    fieldId: integer("field_id")
      .notNull()
      .references(() => fields.id, { onDelete: "cascade" }),
    fieldOptionId: integer("field_option_id").references(() => fieldOptions.id, {
      onDelete: "restrict",
    }),
    textValue: text("text_value"),
    numberValue: integer("number_value"),
  },
  (t) => [
    uniqueIndex("design_field_values_design_field_option_idx").on(
      t.designId,
      t.fieldId,
      t.fieldOptionId
    ),
  ]
);

/** Fields the customer can't change at all for this design — fixed at the
 *  design's own default value, step skipped entirely in the order wizard. */
export const designLockedFields = sqliteTable(
  "design_locked_fields",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    designId: integer("design_id")
      .notNull()
      .references(() => designs.id, { onDelete: "cascade" }),
    fieldId: integer("field_id")
      .notNull()
      .references(() => fields.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("design_locked_fields_design_field_idx").on(t.designId, t.fieldId)]
);

/** Specific options the customer is not allowed to pick for this particular
 *  design, even though the option is otherwise active globally. */
export const designExcludedOptions = sqliteTable(
  "design_excluded_options",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    designId: integer("design_id")
      .notNull()
      .references(() => designs.id, { onDelete: "cascade" }),
    fieldOptionId: integer("field_option_id")
      .notNull()
      .references(() => fieldOptions.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("design_excluded_options_design_option_idx").on(t.designId, t.fieldOptionId),
  ]
);

/** Which categories a design belongs to — admin picks zero, one, or many per
 *  design; drives the customer-facing category filter chips. Never a fixed
 *  set, so no `is_base` here unlike design_field_values/fields. */
export const designCategories = sqliteTable(
  "design_categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    designId: integer("design_id")
      .notNull()
      .references(() => designs.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => cakeCategories.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("design_categories_design_category_idx").on(t.designId, t.categoryId)]
);

export const constraintPairs = sqliteTable(
  "constraint_pairs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    optionAId: integer("option_a_id")
      .notNull()
      .references(() => fieldOptions.id, { onDelete: "cascade" }),
    optionBId: integer("option_b_id")
      .notNull()
      .references(() => fieldOptions.id, { onDelete: "cascade" }),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch('now','subsec') * 1000)`),
  },
  (t) => [uniqueIndex("constraint_pairs_options_idx").on(t.optionAId, t.optionBId)]
);

/** One checkout — a customer's cart submitted to the baker in one go. May
 *  contain several cakes (see order_items below); contact info, pickup, and
 *  the summed total all live here at the checkout level, not per cake. */
export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // set when the customer was logged in at checkout; null for guest orders.
  // "set null" on delete since an order is a business record that should
  // outlive the account that placed it.
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  comments: text("comments"),
  totalPriceCents: integer("total_price_cents").notNull(),
  status: text("status").notNull().default("new"), // new | viewed | archived
  // nullable only because orders placed before pickup scheduling existed have none
  pickupDate: text("pickup_date"), // YYYY-MM-DD
  pickupTime: text("pickup_time"), // HH:MM, 24h
  // only set on custom-cake quote requests: call | sms | whatsapp | email
  contactPreference: text("contact_preference"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now','subsec') * 1000)`),
});

/** One configured cake within a checkout — one row per cart item. Null
 *  designId means this item is a custom-cake quote request. */
export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  designId: integer("design_id").references(() => designs.id, { onDelete: "restrict" }),
  priceCents: integer("price_cents").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now','subsec') * 1000)`),
});

/** Optional reference photos a customer attaches to a custom-cake cart item. */
export const orderReferenceImages = sqliteTable("order_reference_images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderItemId: integer("order_item_id")
    .notNull()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now','subsec') * 1000)`),
});

// --- pickup scheduling --------------------------------------------------
// Admin-configured availability for the order wizard's pickup calendar.
// A requested slot is valid when: the date's effective hours (override, if
// any, else the weekly default for that day-of-week) are open, the time
// falls on one of the generated slots, and the slot is far enough in the
// future to satisfy pickupSettings.leadTimeHours — see src/lib/availability.ts,
// which is the single source of truth for that logic on both client and server.

/** Singleton row (id=1) of pickup-wide settings. */
export const pickupSettings = sqliteTable("pickup_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leadTimeHours: integer("lead_time_hours").notNull().default(24),
  maxAdvanceDays: integer("max_advance_days").notNull().default(60),
  slotIntervalMinutes: integer("slot_interval_minutes").notNull().default(30),
  // null means no cap — any number of orders can share a pickup day
  maxOrdersPerDay: integer("max_orders_per_day"),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch('now','subsec') * 1000)`),
});

/** Default open hours per day of week (0=Sunday..6=Saturday), one row each. */
export const pickupWeeklyHours = sqliteTable("pickup_weekly_hours", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dayOfWeek: integer("day_of_week").notNull().unique(),
  isOpen: integer("is_open", { mode: "boolean" }).notNull().default(false),
  openTime: text("open_time"), // HH:MM, 24h — set when isOpen
  closeTime: text("close_time"),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch('now','subsec') * 1000)`),
});

/** Date-range exceptions to the weekly default — a closure (vacation, holiday)
 *  or custom hours for a specific day or span of days. Takes precedence over
 *  pickupWeeklyHours for any date it covers. */
export const pickupDateOverrides = sqliteTable("pickup_date_overrides", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  endDate: text("end_date").notNull(), // YYYY-MM-DD, inclusive; equals startDate for a single day
  closed: integer("closed", { mode: "boolean" }).notNull().default(true),
  openTime: text("open_time"), // set when closed=false
  closeTime: text("close_time"),
  note: text("note"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now','subsec') * 1000)`),
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone"),
  // grants access to /admin — managed from the admin section's own Admins
  // page (see src/app/admin/(protected)/admins); at least one must exist,
  // enforced in that page's demote action, not at the schema level.
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  // opt-in to promotional email/text from Vanessa's Cakes — checked by
  // default at signup, editable any time from the account page
  marketingOptIn: integer("marketing_opt_in", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now','subsec') * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch('now','subsec') * 1000)`),
});

/** One row per way a user can sign in. provider "local" today (passwordHash
 *  set, providerAccountId = email); a future "google" row would set
 *  providerAccountId to Google's sub and leave passwordHash null — no change
 *  to users or orders needed to add it. */
export const authAccounts = sqliteTable(
  "auth_accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // "local" | "google" (future)
    providerAccountId: text("provider_account_id").notNull(),
    passwordHash: text("password_hash"), // local provider only
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch('now','subsec') * 1000)`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch('now','subsec') * 1000)`),
  },
  (t) => [uniqueIndex("auth_accounts_provider_account_idx").on(t.provider, t.providerAccountId)]
);

/** A logged-in customer's saved cart — one row per configured cake, written
 *  the moment they add/edit/remove it in the wizard so it survives across
 *  devices/sessions until checkout. Guests never get a row here; their cart
 *  lives in the browser only (see CartContext) until they log in, at which
 *  point it's merged in here and the browser copy is dropped. Cleared for a
 *  user the moment their cart is submitted as a real order (see submitCart) —
 *  never touched on logout, only hidden from the UI. */
export const cartItems = sqliteTable("cart_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  designId: integer("design_id").references(() => designs.id, { onDelete: "cascade" }),
  isCustom: integer("is_custom", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now','subsec') * 1000)`),
});

/** One answered field for a cart item — same shape as order_selections, but
 *  without the price/label snapshot since nothing is final until checkout. */
export const cartItemSelections = sqliteTable("cart_item_selections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cartItemId: integer("cart_item_id")
    .notNull()
    .references(() => cartItems.id, { onDelete: "cascade" }),
  fieldId: integer("field_id")
    .notNull()
    .references(() => fields.id, { onDelete: "cascade" }),
  fieldOptionId: integer("field_option_id").references(() => fieldOptions.id, { onDelete: "cascade" }),
  textValue: text("text_value"),
  numberValue: integer("number_value"),
});

/** Reference photos already uploaded for a custom-cake cart item — copied
 *  into order_reference_images at checkout rather than re-uploaded. */
export const cartItemReferenceImages = sqliteTable("cart_item_reference_images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cartItemId: integer("cart_item_id")
    .notNull()
    .references(() => cartItems.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now','subsec') * 1000)`),
});

export const orderSelections = sqliteTable(
  "order_selections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderItemId: integer("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    fieldId: integer("field_id")
      .notNull()
      .references(() => fields.id, { onDelete: "restrict" }),
    fieldOptionId: integer("field_option_id").references(() => fieldOptions.id, {
      onDelete: "restrict",
    }),
    textValue: text("text_value"),
    numberValue: integer("number_value"),
    labelSnapshot: text("label_snapshot").notNull(),
    priceCentsSnapshot: integer("price_cents_snapshot").notNull().default(0),
  },
  (t) => [
    uniqueIndex("order_selections_item_field_option_idx").on(
      t.orderItemId,
      t.fieldId,
      t.fieldOptionId
    ),
  ]
);
