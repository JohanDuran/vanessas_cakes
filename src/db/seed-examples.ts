import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, dataDir } from "./index";
import {
  constraintPairs,
  designExcludedOptions,
  designFieldValues,
  designLockedFields,
  designPhotos,
  designs,
  fieldOptions,
  fields,
  orders,
  orderSelections,
} from "./schema";
import type { BaseFieldSlug, FieldType } from "../lib/fields";

// --- tiny solid-color PNG encoder (no deps) -------------------------------

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let i = 0; i < 8; i++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function solidColorPng(size: number, [r, g, b]: [number, number, number]): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowLen = size * 3 + 1;
  const raw = Buffer.alloc(rowLen * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * rowLen;
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const px = rowStart + 1 + x * 3;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
    }
  }
  const idat = zlib.deflateSync(raw);

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function savePlaceholderPhoto(color: [number, number, number]): string {
  const uploadsDir = path.join(dataDir, "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.png`;
  fs.writeFileSync(path.join(uploadsDir, filename), solidColorPng(600, color));
  return filename;
}

// --- custom fields ----------------------------------------------------------
// A couple of admin-defined fields (unified with the base ones, isBase: false)
// so the seeded data demonstrates the full field system: a locked custom text
// field and an included-but-unlocked custom multi-select field.

const customFieldSeeds: {
  slug: string;
  name: string;
  type: FieldType;
  options: { name: string; priceCents: number }[];
}[] = [
  { slug: "topper-message", name: "Topper Message", type: "text", options: [] },
  {
    slug: "extra-toppings",
    name: "Extra Toppings",
    type: "multi_select",
    options: [
      { name: "Edible Glitter", priceCents: 300 },
      { name: "Fresh Mint Sprig", priceCents: 150 },
      { name: "Chocolate Shavings", priceCents: 250 },
    ],
  },
];

// --- design seed data --------------------------------------------------------

type CustomFieldValueSeed =
  | { fieldSlug: string; kind: "options"; optionNames: string[]; locked?: boolean }
  | { fieldSlug: string; kind: "text"; value: string; locked?: boolean }
  | { fieldSlug: string; kind: "number"; value: number; locked?: boolean };

type DesignSeed = {
  name: string;
  description: string;
  color: [number, number, number];
  chargedDollars: number;
  // base field slug -> option name; only fields that actually apply to this
  // design need an entry (e.g. tier_levels/tier_size are omitted for every
  // Standard-style example here, same as a real admin would leave them blank)
  recipe: Partial<Record<BaseFieldSlug, string>>;
  lockedBaseFields?: BaseFieldSlug[];
  excludedOptions?: { fieldSlug: BaseFieldSlug; name: string }[];
  customFieldValues?: CustomFieldValueSeed[];
};

const designSeeds: DesignSeed[] = [
  {
    name: "Midnight Choco Drip",
    description: "Rich chocolate layers with a glossy drip finish.",
    color: [107, 66, 38],
    chargedDollars: 78,
    recipe: {
      cake_style: "Standard",
      size: "Large",
      cake_type: "Classic Layer Cake",
      flavor: "Chocolate",
      filling: "Chocolate Ganache",
      frosting: "Buttercream",
      decoration: "Choco Drip",
    },
    // demonstrates a locked base field and an excluded base option
    lockedBaseFields: ["cake_type"],
    excludedOptions: [{ fieldSlug: "frosting", name: "Fondant" }],
    // demonstrates a locked custom field (fixed to an admin-set default)
    customFieldValues: [{ fieldSlug: "topper-message", kind: "text", value: "Happy Birthday!", locked: true }],
  },
  {
    name: "Velvet Bloom",
    description: "Classic red velvet dressed in cream-cheese frosting and sugar flowers.",
    color: [193, 53, 94],
    chargedDollars: 72,
    recipe: {
      cake_style: "Standard",
      size: "Medium",
      cake_type: "Naked Cake",
      flavor: "Red Velvet",
      filling: "Cream Cheese",
      frosting: "Cream Cheese Frosting",
      decoration: "Sugar Flowers",
    },
    // demonstrates an included-but-unlocked custom field (customer can change it)
    customFieldValues: [{ fieldSlug: "extra-toppings", kind: "options", optionNames: ["Edible Glitter"] }],
  },
  {
    name: "Marble Sprinkle Party",
    description: "Swirled marble crumb, pastel icing, and a shower of sprinkles.",
    color: [227, 214, 251],
    chargedDollars: 48,
    recipe: {
      cake_style: "Standard",
      size: "Small",
      cake_type: "Classic Layer Cake",
      flavor: "Marble",
      filling: "Vanilla Cream",
      frosting: "Buttercream",
      decoration: "Sprinkles",
    },
  },
  {
    name: "Golden Lemon Kiss",
    description: "Zesty lemon cake finished with delicate gold leaf accents.",
    color: [255, 229, 138],
    chargedDollars: 68,
    recipe: {
      cake_style: "Standard",
      size: "Medium",
      cake_type: "Classic Layer Cake",
      flavor: "Vanilla",
      filling: "Lemon Curd",
      frosting: "Whipped Cream",
      decoration: "Gold Leaf",
    },
  },
  {
    name: "Carlotta Fiesta",
    description: "A festive Carlotta with salted caramel and macarons on top.",
    color: [230, 145, 60],
    chargedDollars: 82,
    recipe: {
      cake_style: "Standard",
      size: "Medium",
      cake_type: "Carlotta",
      flavor: "Chocolate",
      filling: "Salted Caramel",
      frosting: "Fondant",
      decoration: "Macarons",
    },
  },
];

type ConstraintSeed = { a: [BaseFieldSlug, string]; b: [BaseFieldSlug, string] };

const constraintSeeds: ConstraintSeed[] = [
  { a: ["cake_type", "Naked Cake"], b: ["frosting", "Fondant"] },
  { a: ["cake_type", "Carlotta"], b: ["filling", "Lemon Curd"] },
  { a: ["cake_type", "Sheet Cake"], b: ["decoration", "Gold Leaf"] },
];

type OrderSeed = {
  designName: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  comments?: string;
  status: "new" | "viewed" | "archived";
  overrides?: Partial<Record<BaseFieldSlug, string>>;
};

const orderSeeds: OrderSeed[] = [
  {
    designName: "Midnight Choco Drip",
    customerName: "Priya Shah",
    customerEmail: "priya.shah@example.com",
    customerPhone: "555-0142",
    comments: "Can we add 'Happy Anniversary' in gold script?",
    status: "new",
  },
  {
    designName: "Velvet Bloom",
    customerName: "Marco Lopez",
    customerEmail: "marco.lopez@example.com",
    status: "archived",
    overrides: { size: "Large" },
  },
];

function main() {
  // ensure the custom fields (and their options) exist before anything below
  // looks them up — idempotent, same pattern as the design/constraint/order loops
  const existingFieldsBySlug = new Map(db.select().from(fields).all().map((f) => [f.slug, f]));
  for (const cf of customFieldSeeds) {
    if (existingFieldsBySlug.has(cf.slug)) continue;
    const insertedField = db
      .insert(fields)
      .values({ slug: cf.slug, name: cf.name, type: cf.type, isBase: false, updatedAt: Date.now() })
      .returning()
      .get();
    cf.options.forEach((opt, index) => {
      db.insert(fieldOptions)
        .values({ fieldId: insertedField.id, name: opt.name, priceCents: opt.priceCents, sortOrder: index, updatedAt: Date.now() })
        .run();
    });
    console.log(`Created custom field "${cf.name}".`);
  }

  const allFields = db.select().from(fields).all();
  const fieldBySlug = new Map(allFields.map((f) => [f.slug, f]));
  const allOptions = db.select().from(fieldOptions).all();
  const optionByFieldIdName = new Map<string, (typeof allOptions)[number]>();
  for (const opt of allOptions) optionByFieldIdName.set(`${opt.fieldId}:${opt.name}`, opt);

  const requireField = (slug: string) => {
    const field = fieldBySlug.get(slug);
    if (!field) throw new Error(`Field not found: ${slug} — run "npm run db:seed" first.`);
    return field;
  };
  const lookupOption = (slug: string, name: string) => {
    const field = requireField(slug);
    const opt = optionByFieldIdName.get(`${field.id}:${name}`);
    if (!opt) throw new Error(`Catalog option not found: ${slug} / ${name} — run "npm run db:seed" first.`);
    return opt;
  };

  const existingDesigns = db.select().from(designs).all();
  const existingNames = new Set(existingDesigns.map((d) => d.name));
  const designIdByName = new Map<string, number>(existingDesigns.map((d) => [d.name, d.id]));

  for (const seed of designSeeds) {
    if (existingNames.has(seed.name)) {
      console.log(`Design "${seed.name}" already exists — skipping.`);
      continue;
    }

    const baseSelections = (Object.keys(seed.recipe) as BaseFieldSlug[]).map((slug) => ({
      field: requireField(slug),
      option: lookupOption(slug, seed.recipe[slug]!),
    }));

    let standardCents = baseSelections.reduce((sum, s) => sum + s.option.priceCents, 0);

    const customSelections = (seed.customFieldValues ?? []).map((cfv) => {
      const field = requireField(cfv.fieldSlug);
      if (cfv.kind === "options") {
        const options = cfv.optionNames.map((name) => lookupOption(cfv.fieldSlug, name));
        standardCents += options.reduce((sum, o) => sum + o.priceCents, 0);
        return { field, kind: "options" as const, options, locked: cfv.locked ?? false };
      }
      if (cfv.kind === "text") return { field, kind: "text" as const, value: cfv.value, locked: cfv.locked ?? false };
      return { field, kind: "number" as const, value: cfv.value, locked: cfv.locked ?? false };
    });

    const chargedCents = Math.round(seed.chargedDollars * 100);
    const premiumCents = chargedCents - standardCents;

    const designId = db.transaction((tx) => {
      const inserted = tx
        .insert(designs)
        .values({
          name: seed.name,
          description: seed.description,
          chargedPriceCents: chargedCents,
          premiumCents,
          published: true,
          updatedAt: Date.now(),
        })
        .returning({ id: designs.id })
        .get();

      for (const { field, option } of baseSelections) {
        tx.insert(designFieldValues).values({ designId: inserted.id, fieldId: field.id, fieldOptionId: option.id }).run();
      }

      for (const cs of customSelections) {
        if (cs.kind === "options") {
          for (const option of cs.options) {
            tx.insert(designFieldValues).values({ designId: inserted.id, fieldId: cs.field.id, fieldOptionId: option.id }).run();
          }
        } else if (cs.kind === "text") {
          tx.insert(designFieldValues).values({ designId: inserted.id, fieldId: cs.field.id, textValue: cs.value }).run();
        } else {
          tx.insert(designFieldValues).values({ designId: inserted.id, fieldId: cs.field.id, numberValue: cs.value }).run();
        }
      }

      for (const slug of seed.lockedBaseFields ?? []) {
        tx.insert(designLockedFields).values({ designId: inserted.id, fieldId: requireField(slug).id }).run();
      }
      for (const cs of customSelections) {
        if (cs.locked) tx.insert(designLockedFields).values({ designId: inserted.id, fieldId: cs.field.id }).run();
      }

      for (const excl of seed.excludedOptions ?? []) {
        tx.insert(designExcludedOptions)
          .values({ designId: inserted.id, fieldOptionId: lookupOption(excl.fieldSlug, excl.name).id })
          .run();
      }

      return inserted.id;
    });

    const photoPath = savePlaceholderPhoto(seed.color);
    db.insert(designPhotos).values({ designId, path: photoPath, isPrimary: true }).run();

    designIdByName.set(seed.name, designId);
    console.log(`Created design "${seed.name}" (id ${designId}, premium ${(premiumCents / 100).toFixed(2)}).`);
  }

  const existingPairs = db.select().from(constraintPairs).all();
  const pairExists = (aId: number, bId: number) =>
    existingPairs.some((p) => (p.optionAId === aId && p.optionBId === bId) || (p.optionAId === bId && p.optionBId === aId));

  for (const seed of constraintSeeds) {
    const a = lookupOption(seed.a[0], seed.a[1]);
    const b = lookupOption(seed.b[0], seed.b[1]);
    if (pairExists(a.id, b.id)) {
      console.log(`Constraint ${seed.a[1]} x ${seed.b[1]} already exists — skipping.`);
      continue;
    }
    const [first, second] = a.id < b.id ? [a, b] : [b, a];
    db.insert(constraintPairs).values({ optionAId: first.id, optionBId: second.id }).run();
    console.log(`Created constraint: ${seed.a[1]} x ${seed.b[1]}.`);
  }

  const existingOrders = db.select().from(orders).all();
  const existingCustomers = new Set(existingOrders.map((o) => o.customerEmail));

  for (const seed of orderSeeds) {
    if (existingCustomers.has(seed.customerEmail)) {
      console.log(`Order for ${seed.customerEmail} already exists — skipping.`);
      continue;
    }
    const designId = designIdByName.get(seed.designName);
    if (!designId) throw new Error(`Design not found for order seed: ${seed.designName}`);

    const designFieldValueRows = db.select().from(designFieldValues).where(eq(designFieldValues.designId, designId)).all();
    const design = db.select().from(designs).all().find((d) => d.id === designId)!;

    // only the fields this design actually answered (base fields that don't
    // apply, e.g. tier_levels/tier_size for a Standard-style design, have no
    // row and are correctly skipped) plus whichever fields this order overrides
    const fieldById = new Map(allFields.map((f) => [f.id, f]));
    const relevantFieldIds = new Set(designFieldValueRows.map((r) => r.fieldId));
    for (const slug of Object.keys(seed.overrides ?? {}) as BaseFieldSlug[]) {
      relevantFieldIds.add(requireField(slug).id);
    }
    const selections = [...relevantFieldIds].map((fieldId) => {
      const field = fieldById.get(fieldId)!;
      const overrideName = seed.overrides?.[field.slug as BaseFieldSlug];
      if (overrideName) return { field, option: lookupOption(field.slug, overrideName) };
      const row = designFieldValueRows.find((r) => r.fieldId === fieldId)!;
      const option = allOptions.find((o) => o.id === row.fieldOptionId)!;
      return { field, option };
    });

    const standardCents = selections.reduce((sum, s) => sum + s.option.priceCents, 0);
    const totalCents = standardCents + design.premiumCents;

    db.transaction((tx) => {
      const inserted = tx
        .insert(orders)
        .values({
          designId,
          customerName: seed.customerName,
          customerEmail: seed.customerEmail,
          customerPhone: seed.customerPhone ?? null,
          comments: seed.comments ?? null,
          totalPriceCents: totalCents,
          status: seed.status,
        })
        .returning({ id: orders.id })
        .get();

      for (const { field, option } of selections) {
        tx.insert(orderSelections)
          .values({
            orderId: inserted.id,
            fieldId: field.id,
            fieldOptionId: option.id,
            labelSnapshot: option.name,
            priceCentsSnapshot: option.priceCents,
          })
          .run();
      }
    });

    console.log(`Created order for ${seed.customerName} (${seed.status}).`);
  }

  console.log("Done.");
}

main();
