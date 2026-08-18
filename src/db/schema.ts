import { sql } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// Axis is a fixed TS union (see src/lib/axes.ts), stored as plain text here —
// SQLite has no native enum type, validity is enforced at the app layer (zod).

export const catalogItems = sqliteTable("catalog_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  axis: text("axis").notNull(),
  name: text("name").notNull(),
  priceCents: integer("price_cents").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),

  // size-axis-only metadata
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
  // server-computed: chargedPriceCents - sum(standard prices of recipe items)
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

export const designRecipeItems = sqliteTable(
  "design_recipe_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    designId: integer("design_id")
      .notNull()
      .references(() => designs.id, { onDelete: "cascade" }),
    axis: text("axis").notNull(),
    catalogItemId: integer("catalog_item_id")
      .notNull()
      .references(() => catalogItems.id, { onDelete: "restrict" }),
  },
  (t) => [uniqueIndex("design_recipe_items_design_axis_idx").on(t.designId, t.axis)]
);

export const constraintPairs = sqliteTable(
  "constraint_pairs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    axisA: text("axis_a").notNull(),
    itemAId: integer("item_a_id")
      .notNull()
      .references(() => catalogItems.id, { onDelete: "cascade" }),
    axisB: text("axis_b").notNull(),
    itemBId: integer("item_b_id")
      .notNull()
      .references(() => catalogItems.id, { onDelete: "cascade" }),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch('now','subsec') * 1000)`),
  },
  (t) => [uniqueIndex("constraint_pairs_items_idx").on(t.itemAId, t.itemBId)]
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
    axis: text("axis").notNull(),
    catalogItemId: integer("catalog_item_id")
      .notNull()
      .references(() => catalogItems.id, { onDelete: "restrict" }),
    itemNameSnapshot: text("item_name_snapshot").notNull(),
    priceCentsSnapshot: integer("price_cents_snapshot").notNull(),
  },
  (t) => [uniqueIndex("order_selections_order_axis_idx").on(t.orderId, t.axis)]
);
