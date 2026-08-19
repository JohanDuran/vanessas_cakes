import { db } from "./index";
import { fields, fieldOptions, fieldOptionDimensions } from "./schema";
import { BASE_FIELD_SLUGS, BASE_FIELD_LABELS, type BaseFieldSlug } from "../lib/fields";

type SeedOption = {
  fieldSlug: BaseFieldSlug;
  name: string;
  priceCents: number;
  sortOrder: number;
  diameterIn?: string;
  shape?: "round" | "square" | "sheet";
  tiers?: number;
  servesMin?: number;
  servesMax?: number;
};

// Ported from the old src/customize/data.ts (Vite app) plus placeholder
// starter rows for cake_type/frosting, which had no prior data — the owner
// should replace/expand these via /admin/catalog once the app ships.
const seedOptions: SeedOption[] = [
  // sizes (ported from old `sizes`, with shape/servings visual-aid metadata added)
  { fieldSlug: "size", name: "Small", priceCents: 3500, sortOrder: 0, diameterIn: '6"', shape: "round", tiers: 1, servesMin: 6, servesMax: 8 },
  { fieldSlug: "size", name: "Medium", priceCents: 5200, sortOrder: 1, diameterIn: '8"', shape: "round", tiers: 1, servesMin: 10, servesMax: 14 },
  { fieldSlug: "size", name: "Large", priceCents: 7400, sortOrder: 2, diameterIn: '10"', shape: "round", tiers: 1, servesMin: 18, servesMax: 22 },
  { fieldSlug: "size", name: "XL Two-Tier", priceCents: 11000, sortOrder: 3, diameterIn: '12"', shape: "round", tiers: 2, servesMin: 30, servesMax: 36 },

  // cake types — placeholder starter set, no equivalent existed in the old app
  { fieldSlug: "cake_type", name: "Classic Layer Cake", priceCents: 0, sortOrder: 0 },
  { fieldSlug: "cake_type", name: "Carlotta", priceCents: 500, sortOrder: 1 },
  { fieldSlug: "cake_type", name: "Naked Cake", priceCents: 800, sortOrder: 2 },
  { fieldSlug: "cake_type", name: "Sheet Cake", priceCents: -500, sortOrder: 3 },

  // flavors (ported from old `flavors`)
  { fieldSlug: "flavor", name: "Chocolate", priceCents: 0, sortOrder: 0 },
  { fieldSlug: "flavor", name: "Vanilla", priceCents: 0, sortOrder: 1 },
  { fieldSlug: "flavor", name: "Red Velvet", priceCents: 400, sortOrder: 2 },
  { fieldSlug: "flavor", name: "Marble", priceCents: 300, sortOrder: 3 },

  // fillings (ported from old `fillings`)
  { fieldSlug: "filling", name: "Strawberry Jam", priceCents: 300, sortOrder: 0 },
  { fieldSlug: "filling", name: "Chocolate Ganache", priceCents: 400, sortOrder: 1 },
  { fieldSlug: "filling", name: "Vanilla Cream", priceCents: 200, sortOrder: 2 },
  { fieldSlug: "filling", name: "Lemon Curd", priceCents: 300, sortOrder: 3 },
  { fieldSlug: "filling", name: "Salted Caramel", priceCents: 400, sortOrder: 4 },
  { fieldSlug: "filling", name: "Cream Cheese", priceCents: 300, sortOrder: 5 },

  // frostings — placeholder starter set, no equivalent existed in the old app
  { fieldSlug: "frosting", name: "Buttercream", priceCents: 0, sortOrder: 0 },
  { fieldSlug: "frosting", name: "Cream Cheese Frosting", priceCents: 300, sortOrder: 1 },
  { fieldSlug: "frosting", name: "Fondant", priceCents: 900, sortOrder: 2 },
  { fieldSlug: "frosting", name: "Whipped Cream", priceCents: -200, sortOrder: 3 },

  // decorations (ported from old `decorations`, now single-select per field)
  { fieldSlug: "decoration", name: "Sprinkles", priceCents: 200, sortOrder: 0 },
  { fieldSlug: "decoration", name: "Fresh Berries", priceCents: 500, sortOrder: 1 },
  { fieldSlug: "decoration", name: "Choco Drip", priceCents: 400, sortOrder: 2 },
  { fieldSlug: "decoration", name: "Sugar Flowers", priceCents: 600, sortOrder: 3 },
  { fieldSlug: "decoration", name: "Gold Leaf", priceCents: 800, sortOrder: 4 },
  { fieldSlug: "decoration", name: "Macarons", priceCents: 500, sortOrder: 5 },
];

function seed() {
  const existing = db.select().from(fields).all();
  if (existing.length > 0) {
    console.log(`fields already has ${existing.length} rows — skipping seed.`);
    return;
  }

  const fieldIdBySlug = new Map<string, number>();
  BASE_FIELD_SLUGS.forEach((slug, index) => {
    const inserted = db
      .insert(fields)
      .values({
        slug,
        name: BASE_FIELD_LABELS[slug],
        type: "single_select",
        isBase: true,
        hasShapeDiagram: slug === "size",
        sortOrder: index,
        updatedAt: Date.now(),
      })
      .returning({ id: fields.id })
      .get();
    fieldIdBySlug.set(slug, inserted.id);
  });

  for (const opt of seedOptions) {
    const insertedOption = db
      .insert(fieldOptions)
      .values({
        fieldId: fieldIdBySlug.get(opt.fieldSlug)!,
        name: opt.name,
        priceCents: opt.priceCents,
        sortOrder: opt.sortOrder,
        updatedAt: Date.now(),
      })
      .returning({ id: fieldOptions.id })
      .get();

    const hasDims =
      opt.diameterIn != null ||
      opt.shape != null ||
      opt.tiers != null ||
      opt.servesMin != null ||
      opt.servesMax != null;
    if (hasDims) {
      db.insert(fieldOptionDimensions)
        .values({
          fieldOptionId: insertedOption.id,
          diameterIn: opt.diameterIn ?? null,
          shape: opt.shape ?? null,
          tiers: opt.tiers ?? null,
          servesMin: opt.servesMin ?? null,
          servesMax: opt.servesMax ?? null,
          updatedAt: Date.now(),
        })
        .run();
    }
  }

  console.log(`Seeded 6 base fields and ${seedOptions.length} options.`);
}

seed();
