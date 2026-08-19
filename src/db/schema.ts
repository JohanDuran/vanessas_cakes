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

export const designs = sqliteTable("designs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  chargedPriceCents: integer("charged_price_cents").notNull(),
  // server-computed: chargedPriceCents - sum(standard prices of the design's field values)
  premiumCents: integer("premium_cents").notNull().default(0),
  published: integer("published", { mode: "boolean" }).notNull().default(false),
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

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  designId: integer("design_id")
    .notNull()
    .references(() => designs.id, { onDelete: "restrict" }),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  comments: text("comments"),
  totalPriceCents: integer("total_price_cents").notNull(),
  status: text("status").notNull().default("new"), // new | viewed | archived
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now','subsec') * 1000)`),
});

export const orderSelections = sqliteTable(
  "order_selections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
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
    uniqueIndex("order_selections_order_field_option_idx").on(
      t.orderId,
      t.fieldId,
      t.fieldOptionId
    ),
  ]
);
