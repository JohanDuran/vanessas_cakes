import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { db, dataDir } from "./index";
import { catalogItems, constraintPairs, designPhotos, designRecipeItems, designs, orders, orderSelections } from "./schema";
import { AXES, type Axis } from "../lib/axes";

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

// --- seed data --------------------------------------------------------------

type DesignSeed = {
  name: string;
  description: string;
  color: [number, number, number];
  chargedDollars: number;
  recipe: Record<Axis, string>; // axis -> catalog item name
};

const designSeeds: DesignSeed[] = [
  {
    name: "Midnight Choco Drip",
    description: "Rich chocolate layers with a glossy drip finish.",
    color: [107, 66, 38],
    chargedDollars: 78,
    recipe: {
      size: "Large",
      cake_type: "Classic Layer Cake",
      flavor: "Chocolate",
      filling: "Chocolate Ganache",
      frosting: "Buttercream",
      decoration: "Choco Drip",
    },
  },
  {
    name: "Velvet Bloom",
    description: "Classic red velvet dressed in cream-cheese frosting and sugar flowers.",
    color: [193, 53, 94],
    chargedDollars: 72,
    recipe: {
      size: "Medium",
      cake_type: "Naked Cake",
      flavor: "Red Velvet",
      filling: "Cream Cheese",
      frosting: "Cream Cheese Frosting",
      decoration: "Sugar Flowers",
    },
  },
  {
    name: "Marble Sprinkle Party",
    description: "Swirled marble crumb, pastel icing, and a shower of sprinkles.",
    color: [227, 214, 251],
    chargedDollars: 48,
    recipe: {
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
      size: "Medium",
      cake_type: "Carlotta",
      flavor: "Chocolate",
      filling: "Salted Caramel",
      frosting: "Fondant",
      decoration: "Macarons",
    },
  },
];

type ConstraintSeed = { a: [Axis, string]; b: [Axis, string] };

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
  overrides?: Partial<Record<Axis, string>>;
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
  const items = db.select().from(catalogItems).all();
  const itemByAxisName = new Map<string, (typeof items)[number]>();
  for (const item of items) itemByAxisName.set(`${item.axis}:${item.name}`, item);

  const lookup = (axis: Axis, name: string) => {
    const item = itemByAxisName.get(`${axis}:${name}`);
    if (!item) throw new Error(`Catalog item not found: ${axis} / ${name} — run "npm run db:seed" first.`);
    return item;
  };

  const existingDesigns = db.select().from(designs).all();
  const existingNames = new Set(existingDesigns.map((d) => d.name));

  const designIdByName = new Map<string, number>(existingDesigns.map((d) => [d.name, d.id]));

  for (const seed of designSeeds) {
    if (existingNames.has(seed.name)) {
      console.log(`Design "${seed.name}" already exists — skipping.`);
      continue;
    }

    const recipeItems = AXES.map((axis) => ({ axis, item: lookup(axis, seed.recipe[axis]) }));
    const standardCents = recipeItems.reduce((sum, r) => sum + r.item.priceCents, 0);
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

      for (const { axis, item } of recipeItems) {
        tx.insert(designRecipeItems).values({ designId: inserted.id, axis, catalogItemId: item.id }).run();
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
    existingPairs.some((p) => (p.itemAId === aId && p.itemBId === bId) || (p.itemAId === bId && p.itemBId === aId));

  for (const seed of constraintSeeds) {
    const a = lookup(seed.a[0], seed.a[1]);
    const b = lookup(seed.b[0], seed.b[1]);
    if (pairExists(a.id, b.id)) {
      console.log(`Constraint ${seed.a[1]} x ${seed.b[1]} already exists — skipping.`);
      continue;
    }
    const [first, second] = a.id < b.id ? [{ ...a, axis: seed.a[0] }, { ...b, axis: seed.b[0] }] : [{ ...b, axis: seed.b[0] }, { ...a, axis: seed.a[0] }];
    db.insert(constraintPairs)
      .values({ axisA: first.axis, itemAId: first.id, axisB: second.axis, itemBId: second.id })
      .run();
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

    const recipeRows = db
      .select()
      .from(designRecipeItems)
      .all()
      .filter((r) => r.designId === designId);

    const design = db.select().from(designs).all().find((d) => d.id === designId)!;

    const selections = AXES.map((axis) => {
      const overrideName = seed.overrides?.[axis];
      if (overrideName) return { axis, item: lookup(axis, overrideName) };
      const recipeRow = recipeRows.find((r) => r.axis === axis)!;
      const item = items.find((i) => i.id === recipeRow.catalogItemId)!;
      return { axis, item };
    });

    const standardCents = selections.reduce((sum, s) => sum + s.item.priceCents, 0);
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

      for (const { axis, item } of selections) {
        tx.insert(orderSelections)
          .values({
            orderId: inserted.id,
            axis,
            catalogItemId: item.id,
            itemNameSnapshot: item.name,
            priceCentsSnapshot: item.priceCents,
          })
          .run();
      }
    });

    console.log(`Created order for ${seed.customerName} (${seed.status}).`);
  }

  console.log("Done.");
}

main();
