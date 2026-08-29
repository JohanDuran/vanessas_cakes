import { sql } from "drizzle-orm";
import {
  pgTable,
  pgSchema,
  serial,
  integer,
  bigint,
  boolean,
  text,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Stub for Supabase Auth's auth.users table, so profiles.id can carry a real
// foreign key into it. Supabase (via GoTrue) owns this table's actual
// columns/migrations — this stub only exists so Drizzle can reference its id.
const authSchema = pgSchema("auth");
export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

// timestamps are stored as epoch-milliseconds (bigint, mode "number") rather
// than a native `timestamp` column — keeps every createdAt/updatedAt a plain
// JS number everywhere in the app, unchanged from the old SQLite schema.

// One unified system for everything a customer answers when ordering a cake —
// the 6 original "base" fields (size, cake type, flavor, filling, frosting,
// decoration) and any admin-defined "custom" fields are the same kind of row,
// distinguished only by `isBase`. See src/lib/fields.ts for the fixed set of
// base slugs and the shared FieldType union — Postgres has no matching native
// enum in use here either; validity of `type`/`slug` is enforced at the app
// layer (zod).

export const fields = pgTable("fields", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull(), // single_select | multi_select | number | text
  isBase: boolean("is_base").notNull().default(false),
  active: boolean("active").notNull().default(true),
  // opt-in: this field's options get the shape/dimension diagram visual in
  // the order wizard, and the matching editable columns in the admin
  // catalog table — independent of which field this is (see field_option_dimensions)
  hasShapeDiagram: boolean("has_shape_diagram").notNull().default(false),
  // text/number fields only: customer must answer before continuing/submitting.
  // Admin's own design-editor form is intentionally exempt — see DesignForm.
  required: boolean("required").notNull().default(false),
  // text/number fields only: flat surcharge added to the order total whenever
  // the customer actually answers this field (see src/lib/pricing.ts)
  additionalPriceCents: integer("additional_price_cents").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: bigint("created_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  updatedAt: bigint("updated_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
});

export const fieldOptions = pgTable("field_options", {
  id: serial("id").primaryKey(),
  fieldId: integer("field_id")
    .notNull()
    .references(() => fields.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  priceCents: integer("price_cents").notNull().default(0),
  active: boolean("active").notNull().default(true),
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

  createdAt: bigint("created_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  updatedAt: bigint("updated_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
});

/** Bolt-on visual/dimension metadata for a field_option — only present when
 *  the owning field has hasShapeDiagram=true and at least one value was set.
 *  Powers ShapeDiagram in the order wizard and the admin catalog table. */
export const fieldOptionDimensions = pgTable("field_option_dimensions", {
  id: serial("id").primaryKey(),
  fieldOptionId: integer("field_option_id")
    .notNull()
    .unique()
    .references(() => fieldOptions.id, { onDelete: "cascade" }),
  diameterIn: text("diameter_in"),
  shape: text("shape"), // round | square | sheet
  tiers: integer("tiers"),
  servesMin: integer("serves_min"),
  servesMax: integer("serves_max"),
  createdAt: bigint("created_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  updatedAt: bigint("updated_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
});

/** A named, admin-built preset in the `tier_size` field — e.g. "Large" for a
 *  4-tier cake. 1:1 with the field_options row that IS the preset; name and
 *  flat priceCents live there, same additive pricing model as every other
 *  option (never derived from the constituent molds' prices). */
export const tierPresets = pgTable("tier_presets", {
  id: serial("id").primaryKey(),
  fieldOptionId: integer("field_option_id")
    .notNull()
    .unique()
    .references(() => fieldOptions.id, { onDelete: "cascade" }),
  levelCount: integer("level_count").notNull(), // 2 | 3 | 4, denormalized for fast filtering
  createdAt: bigint("created_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  updatedAt: bigint("updated_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
});

/** One level of a tier preset's mold stack, position 1 = base/bottom (widest)
 *  up to position levelCount = top (narrowest). moldOptionId always points at
 *  an option in the `size` field — that field stays 100% atomic molds. */
export const tierPresetLevels = pgTable(
  "tier_preset_levels",
  {
    id: serial("id").primaryKey(),
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
export const cakeCategories = pgTable("cake_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: bigint("created_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  updatedAt: bigint("updated_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
});

export const designs = pgTable("designs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  chargedPriceCents: integer("charged_price_cents").notNull(),
  // server-computed: chargedPriceCents - sum(standard prices of the design's field values)
  premiumCents: integer("premium_cents").notNull().default(0),
  published: boolean("published").notNull().default(false),
  // admin-curated pick for the homepage hero carousel — never automatic, so
  // the homepage only ever shows cakes the admin explicitly chose to feature
  featured: boolean("featured").notNull().default(false),
  featuredSortOrder: integer("featured_sort_order").notNull().default(0),
  createdAt: bigint("created_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  updatedAt: bigint("updated_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
});

/** A design's photo. `path` stores the full public Supabase Storage URL
 *  (not a bare filename) — see src/lib/uploads.ts. */
export const designPhotos = pgTable("design_photos", {
  id: serial("id").primaryKey(),
  designId: integer("design_id")
    .notNull()
    .references(() => designs.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: bigint("created_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
});

/** A design's default answer for a field — every base field has exactly one
 *  row (required); a custom field has row(s) only if the admin included it
 *  in this design (inclusion *is* having a value row here). Multi-select
 *  fields can have several rows (one per chosen default option). */
export const designFieldValues = pgTable(
  "design_field_values",
  {
    id: serial("id").primaryKey(),
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
export const designLockedFields = pgTable(
  "design_locked_fields",
  {
    id: serial("id").primaryKey(),
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
export const designExcludedOptions = pgTable(
  "design_excluded_options",
  {
    id: serial("id").primaryKey(),
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
export const designCategories = pgTable(
  "design_categories",
  {
    id: serial("id").primaryKey(),
    designId: integer("design_id")
      .notNull()
      .references(() => designs.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => cakeCategories.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("design_categories_design_category_idx").on(t.designId, t.categoryId)]
);

export const constraintPairs = pgTable(
  "constraint_pairs",
  {
    id: serial("id").primaryKey(),
    optionAId: integer("option_a_id")
      .notNull()
      .references(() => fieldOptions.id, { onDelete: "cascade" }),
    optionBId: integer("option_b_id")
      .notNull()
      .references(() => fieldOptions.id, { onDelete: "cascade" }),
    createdAt: bigint("created_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (t) => [uniqueIndex("constraint_pairs_options_idx").on(t.optionAId, t.optionBId)]
);

/** App-side profile data for a Supabase Auth user — id matches auth.users.id
 *  1:1. Supabase Auth owns email/password/session; this table only holds
 *  data the app itself needs (display name, phone, admin flag, marketing
 *  opt-in). Created by the signup Server Action right after
 *  supabase.auth.signUp() succeeds — see src/app/account/actions.ts. */
export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  // grants access to /admin — managed from the admin section's own Admins
  // page (see src/app/admin/(protected)/admins); at least one must exist,
  // enforced in that page's demote action, not at the schema level.
  isAdmin: boolean("is_admin").notNull().default(false),
  // opt-in to promotional email/text from Vanessa's Cakes — checked by
  // default at signup, editable any time from the account page
  marketingOptIn: boolean("marketing_opt_in").notNull().default(true),
  createdAt: bigint("created_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  updatedAt: bigint("updated_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
});

/** One checkout — a customer's cart submitted to the baker in one go. May
 *  contain several cakes (see order_items below); contact info, pickup, and
 *  the summed total all live here at the checkout level, not per cake. */
export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    // set when the customer was logged in at checkout; null for guest orders.
    // "set null" on delete since an order is a business record that should
    // outlive the account that placed it.
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
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
    // not_required: cart had a custom-quote item or totaled $0, no online charge
    // is collected — the pre-Stripe "we'll contact you" flow. pending: a Stripe
    // Checkout Session was created and we're waiting on its webhook. paid: the
    // webhook (or the thank-you page's fallback check) confirmed payment.
    // failed/expired: card declined, checkout abandoned, or amount mismatch —
    // see src/lib/payments.ts, the only code allowed to move an order to "paid".
    paymentStatus: text("payment_status").notNull().default("not_required"),
    // full: charged totalPriceCents up front (the default, and the only option
    // before deposits existed). deposit: charged amountDueCents (~half of
    // totalPriceCents) up front, remainder collected in person at pickup —
    // see src/lib/payments.ts for how each plan is charged via Stripe.
    paymentPlan: text("payment_plan").notNull().default("full"),
    // The amount actually charged (or being charged) through this order's
    // Stripe Checkout Session — equals totalPriceCents for plan "full" and for
    // orders with no online charge at all (paymentStatus "not_required"), or
    // roughly half of it for plan "deposit". totalPriceCents - amountDueCents
    // is always the outstanding balance; never stored separately to avoid a
    // second value that can drift out of sync.
    amountDueCents: integer("amount_due_cents").notNull().default(0),
    // Set when an admin manually confirms the remaining deposit balance was
    // collected (cash/card at pickup) — there's no automatic follow-up charge
    // for it yet, so this is the only record that it was paid.
    balanceCollectedAt: bigint("balance_collected_at", { mode: "number" }),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    // Random, unguessable lookup key for the public /order/thank-you page —
    // the sequential `id` must never be used there, since anyone could
    // enumerate it to view other customers' orders. Nullable so existing
    // orders from before this column existed don't need a backfill; they
    // simply can't be looked up on that page anymore.
    confirmationToken: text("confirmation_token"),
    createdAt: bigint("created_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (t) => [
    uniqueIndex("orders_stripe_checkout_session_idx").on(t.stripeCheckoutSessionId),
    uniqueIndex("orders_confirmation_token_idx").on(t.confirmationToken),
  ]
);

/** One configured cake within a checkout — one row per cart item. Null
 *  designId means this item is a custom-cake quote request. */
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  designId: integer("design_id").references(() => designs.id, { onDelete: "restrict" }),
  priceCents: integer("price_cents").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: bigint("created_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
});

/** Optional reference photos a customer attaches to a custom-cake cart item.
 *  `path` stores the full public Supabase Storage URL. */
export const orderReferenceImages = pgTable("order_reference_images", {
  id: serial("id").primaryKey(),
  orderItemId: integer("order_item_id")
    .notNull()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: bigint("created_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
});

// --- pickup scheduling --------------------------------------------------
// Admin-configured availability for the order wizard's pickup calendar.
// A requested slot is valid when: the date's effective hours (override, if
// any, else the weekly default for that day-of-week) are open, the time
// falls on one of the generated slots, and the slot is far enough in the
// future to satisfy pickupSettings.leadTimeHours — see src/lib/availability.ts,
// which is the single source of truth for that logic on both client and server.

/** Singleton row (id=1) of pickup-wide settings. */
export const pickupSettings = pgTable("pickup_settings", {
  id: serial("id").primaryKey(),
  leadTimeHours: integer("lead_time_hours").notNull().default(24),
  maxAdvanceDays: integer("max_advance_days").notNull().default(60),
  slotIntervalMinutes: integer("slot_interval_minutes").notNull().default(30),
  // null means no cap — any number of orders can share a pickup day
  maxOrdersPerDay: integer("max_orders_per_day"),
  updatedAt: bigint("updated_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
});

/** Default open hours per day of week (0=Sunday..6=Saturday), one row each. */
export const pickupWeeklyHours = pgTable("pickup_weekly_hours", {
  id: serial("id").primaryKey(),
  dayOfWeek: integer("day_of_week").notNull().unique(),
  isOpen: boolean("is_open").notNull().default(false),
  openTime: text("open_time"), // HH:MM, 24h — set when isOpen
  closeTime: text("close_time"),
  updatedAt: bigint("updated_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
});

/** Date-range exceptions to the weekly default — a closure (vacation, holiday)
 *  or custom hours for a specific day or span of days. Takes precedence over
 *  pickupWeeklyHours for any date it covers. */
export const pickupDateOverrides = pgTable("pickup_date_overrides", {
  id: serial("id").primaryKey(),
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  endDate: text("end_date").notNull(), // YYYY-MM-DD, inclusive; equals startDate for a single day
  closed: boolean("closed").notNull().default(true),
  openTime: text("open_time"), // set when closed=false
  closeTime: text("close_time"),
  note: text("note"),
  createdAt: bigint("created_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
});

/** Singleton row (id=1) of site-wide feature toggles — currently just
 *  maintenance mode, switched from the admin Settings page (see
 *  src/app/admin/(protected)/settings). src/proxy.ts is the only reader. */
export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  updatedAt: bigint("updated_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
});

/** A logged-in customer's saved cart — one row per configured cake, written
 *  the moment they add/edit/remove it in the wizard so it survives across
 *  devices/sessions until checkout. Guests never get a row here; their cart
 *  lives in the browser only (see CartContext) until they log in, at which
 *  point it's merged in here and the browser copy is dropped. Cleared for a
 *  user the moment their cart is submitted as a real order (see submitCart) —
 *  never touched on logout, only hidden from the UI. */
export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  designId: integer("design_id").references(() => designs.id, { onDelete: "cascade" }),
  isCustom: boolean("is_custom").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: bigint("created_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
});

/** One answered field for a cart item — same shape as order_selections, but
 *  without the price/label snapshot since nothing is final until checkout. */
export const cartItemSelections = pgTable("cart_item_selections", {
  id: serial("id").primaryKey(),
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
 *  into order_reference_images at checkout rather than re-uploaded. `path`
 *  stores the full public Supabase Storage URL. */
export const cartItemReferenceImages = pgTable("cart_item_reference_images", {
  id: serial("id").primaryKey(),
  cartItemId: integer("cart_item_id")
    .notNull()
    .references(() => cartItems.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: bigint("created_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
});

export const orderSelections = pgTable(
  "order_selections",
  {
    id: serial("id").primaryKey(),
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
