import { eq } from "drizzle-orm";
import { db } from "./index";
import { fields, fieldOptions, fieldOptionDimensions } from "./schema";
import { CAKE_STYLE_FIELD_SLUG, SIZE_FIELD_SLUG } from "../lib/fields";

/** One-off backfill for DBs seeded before Carlota/Torta Chilena existed —
 *  src/db/seed.ts only seeds a fully empty `fields` table, so an existing
 *  install needs this instead. Idempotent, safe to run more than once. */

type NewStyle = {
  styleName: string;
  styleKind: "carlota" | "torta_chilena";
  sortOrder: number;
  sizes: {
    name: string;
    priceCents: number;
    sortOrder: number;
    diameterIn: number;
    servesMin: number;
    servesMax: number;
  }[];
};

// Prices/dimensions mirror Standard as a placeholder — the owner should tune
// these via /admin/catalog once real costs are in.
const newStyles: NewStyle[] = [
  {
    styleName: "Carlota",
    styleKind: "carlota",
    sortOrder: 3,
    sizes: [
      { name: "Small", priceCents: 3500, sortOrder: 0, diameterIn: 6, servesMin: 6, servesMax: 8 },
      { name: "Medium", priceCents: 5200, sortOrder: 1, diameterIn: 8, servesMin: 10, servesMax: 14 },
      { name: "Large", priceCents: 7400, sortOrder: 2, diameterIn: 10, servesMin: 18, servesMax: 22 },
    ],
  },
  {
    styleName: "Torta Chilena",
    styleKind: "torta_chilena",
    sortOrder: 4,
    sizes: [
      { name: "Small", priceCents: 3500, sortOrder: 0, diameterIn: 6, servesMin: 6, servesMax: 8 },
      { name: "Medium", priceCents: 5200, sortOrder: 1, diameterIn: 8, servesMin: 10, servesMax: 14 },
      { name: "Large", priceCents: 7400, sortOrder: 2, diameterIn: 10, servesMin: 18, servesMax: 22 },
    ],
  },
];

async function main() {
  const styleField = await db.select().from(fields).where(eq(fields.slug, CAKE_STYLE_FIELD_SLUG)).then((r) => r[0]);
  const sizeField = await db.select().from(fields).where(eq(fields.slug, SIZE_FIELD_SLUG)).then((r) => r[0]);
  if (!styleField || !sizeField) {
    throw new Error('cake_style/size fields not found — run "npm run db:seed" first.');
  }

  const existingStyleOptions = await db.select().from(fieldOptions).where(eq(fieldOptions.fieldId, styleField.id));
  const existingSizeOptions = await db.select().from(fieldOptions).where(eq(fieldOptions.fieldId, sizeField.id));

  for (const style of newStyles) {
    if (existingStyleOptions.some((o) => o.styleKind === style.styleKind)) {
      console.log(`Cake style "${style.styleName}" already exists — skipping.`);
      continue;
    }

    await db.insert(fieldOptions).values({
      fieldId: styleField.id,
      name: style.styleName,
      priceCents: 0,
      sortOrder: style.sortOrder,
      styleKind: style.styleKind,
      updatedAt: Date.now(),
    });
    console.log(`Added cake style "${style.styleName}".`);

    for (const size of style.sizes) {
      if (existingSizeOptions.some((o) => o.styleKind === style.styleKind && o.name === size.name)) continue;

      const insertedOption = await db
        .insert(fieldOptions)
        .values({
          fieldId: sizeField.id,
          name: size.name,
          priceCents: size.priceCents,
          sortOrder: size.sortOrder,
          styleKind: style.styleKind,
          updatedAt: Date.now(),
        })
        .returning({ id: fieldOptions.id })
        .then((r) => r[0]);

      await db.insert(fieldOptionDimensions).values({
        fieldOptionId: insertedOption.id,
        diameterIn: size.diameterIn,
        shape: "circle",
        tiers: 1,
        servesMin: size.servesMin,
        servesMax: size.servesMax,
        updatedAt: Date.now(),
      });
    }
    console.log(`Added ${style.sizes.length} sizes for "${style.styleName}".`);
  }

  console.log("Done.");
}

await main();
