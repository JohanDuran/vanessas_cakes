import zlib from "node:zlib";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { saveUploadedPhoto } from "../lib/uploads";
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
  orderItems,
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

async function savePlaceholderPhoto(color: [number, number, number]): Promise<string> {
  const file = new File([new Uint8Array(solidColorPng(600, color))], "placeholder.png", { type: "image/png" });
  return saveUploadedPhoto(file);
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

async function main() {
  // ensure the custom fields (and their options) exist before anything below
  // looks them up — idempotent, same pattern as the design/constraint/order loops
  const existingFieldsBySlug = new Map((await db.select().from(fields)).map((f) => [f.slug, f]));
  for (const cf of customFieldSeeds) {
    if (existingFieldsBySlug.has(cf.slug)) continue;
    const insertedField = await db
      .insert(fields)
      .values({ slug: cf.slug, name: cf.name, type: cf.type, isBase: false, updatedAt: Date.now() })
      .returning()
      .then((r) => r[0]);
    for (const [index, opt] of cf.options.entries()) {
      await db.insert(fieldOptions).values({
        fieldId: insertedField.id,
        name: opt.name,
        priceCents: opt.priceCents,
        sortOrder: index,
        updatedAt: Date.now(),
      });
    }
    console.log(`Created custom field "${cf.name}".`);
  }

  const allFields = await db.select().from(fields);
  const fieldBySlug = new Map(allFields.map((f) => [f.slug, f]));
  const allOptions = await db.select().from(fieldOptions);
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

  const existingDesigns = await db.select().from(designs);
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

    const designId = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(designs)
        .values({
          name: seed.name,
          description: seed.description,
          published: true,
          updatedAt: Date.now(),
        })
        .returning({ id: designs.id })
        .then((r) => r[0]);

      for (const { field, option } of baseSelections) {
        await tx.insert(designFieldValues).values({ designId: inserted.id, fieldId: field.id, fieldOptionId: option.id });
      }

      for (const cs of customSelections) {
        if (cs.kind === "options") {
          for (const option of cs.options) {
            await tx.insert(designFieldValues).values({ designId: inserted.id, fieldId: cs.field.id, fieldOptionId: option.id });
          }
        } else if (cs.kind === "text") {
          await tx.insert(designFieldValues).values({ designId: inserted.id, fieldId: cs.field.id, textValue: cs.value });
        } else {
          await tx.insert(designFieldValues).values({ designId: inserted.id, fieldId: cs.field.id, numberValue: cs.value });
        }
      }

      for (const slug of seed.lockedBaseFields ?? []) {
        await tx.insert(designLockedFields).values({ designId: inserted.id, fieldId: requireField(slug).id });
      }
      for (const cs of customSelections) {
        if (cs.locked) await tx.insert(designLockedFields).values({ designId: inserted.id, fieldId: cs.field.id });
      }

      for (const excl of seed.excludedOptions ?? []) {
        await tx.insert(designExcludedOptions)
          .values({ designId: inserted.id, fieldOptionId: lookupOption(excl.fieldSlug, excl.name).id })
          ;
      }

      return inserted.id;
    });

    const photoPath = await savePlaceholderPhoto(seed.color);
    await db.insert(designPhotos).values({ designId, path: photoPath, isPrimary: true });

    designIdByName.set(seed.name, designId);
    console.log(`Created design "${seed.name}" (id ${designId}, price ${(standardCents / 100).toFixed(2)}).`);
  }

  const existingPairs = await db.select().from(constraintPairs);
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
    await db.insert(constraintPairs).values({ optionAId: first.id, optionBId: second.id });
    console.log(`Created constraint: ${seed.a[1]} x ${seed.b[1]}.`);
  }

  const existingOrders = await db.select().from(orders);
  const existingCustomers = new Set(existingOrders.map((o) => o.customerEmail));

  for (const seed of orderSeeds) {
    if (existingCustomers.has(seed.customerEmail)) {
      console.log(`Order for ${seed.customerEmail} already exists — skipping.`);
      continue;
    }
    const designId = designIdByName.get(seed.designName);
    if (!designId) throw new Error(`Design not found for order seed: ${seed.designName}`);

    const designFieldValueRows = await db.select().from(designFieldValues).where(eq(designFieldValues.designId, designId));

    // only the fields this design actually answered (base fields that don't
    // apply, e.g. tier_levels/tier_size for a Standard-style design, have no
    // row and are correctly skipped) plus whichever fields this order overrides
    const fieldById = new Map(allFields.map((f) => [f.id, f]));
    // this seed script only models option-backed selections (price snapshot
    // comes from option.priceCents) — a design's text/number default values
    // (e.g. a custom "message" field) have no fieldOptionId and are skipped
    const optionBackedFieldIds = new Set(
      designFieldValueRows.filter((r) => r.fieldOptionId != null).map((r) => r.fieldId)
    );
    for (const slug of Object.keys(seed.overrides ?? {}) as BaseFieldSlug[]) {
      optionBackedFieldIds.add(requireField(slug).id);
    }
    const selections = [...optionBackedFieldIds].map((fieldId) => {
      const field = fieldById.get(fieldId)!;
      const overrideName = seed.overrides?.[field.slug as BaseFieldSlug];
      if (overrideName) return { field, option: lookupOption(field.slug, overrideName) };
      const row = designFieldValueRows.find((r) => r.fieldId === fieldId)!;
      const option = allOptions.find((o) => o.id === row.fieldOptionId)!;
      return { field, option };
    });

    const totalCents = selections.reduce((sum, s) => sum + s.option.priceCents, 0);

    await db.transaction(async (tx) => {
      const insertedOrder = await tx
        .insert(orders)
        .values({
          customerName: seed.customerName,
          customerEmail: seed.customerEmail,
          customerPhone: seed.customerPhone ?? null,
          comments: seed.comments ?? null,
          totalPriceCents: totalCents,
          status: seed.status,
        })
        .returning({ id: orders.id })
        .then((r) => r[0]);

      const insertedItem = await tx
        .insert(orderItems)
        .values({
          orderId: insertedOrder.id,
          designId,
          priceCents: totalCents,
          sortOrder: 0,
        })
        .returning({ id: orderItems.id })
        .then((r) => r[0]);

      for (const { field, option } of selections) {
        await tx.insert(orderSelections)
          .values({
            orderItemId: insertedItem.id,
            fieldId: field.id,
            fieldOptionId: option.id,
            labelSnapshot: option.name,
            priceCentsSnapshot: option.priceCents,
          })
          ;
      }
    });

    console.log(`Created order for ${seed.customerName} (${seed.status}).`);
  }

  console.log("Done.");
}

await main();
