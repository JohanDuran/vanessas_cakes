import { db } from "./index";
import { catalogItems } from "./schema";
import type { Axis } from "../lib/axes";

type SeedItem = {
  axis: Axis;
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
// should replace/expand these via /admin/catalog once Phase 1 ships.
const seedItems: SeedItem[] = [
  // sizes (ported from old `sizes`, with shape/servings visual-aid metadata added)
  { axis: "size", name: "Small", priceCents: 3500, sortOrder: 0, diameterIn: '6"', shape: "round", tiers: 1, servesMin: 6, servesMax: 8 },
  { axis: "size", name: "Medium", priceCents: 5200, sortOrder: 1, diameterIn: '8"', shape: "round", tiers: 1, servesMin: 10, servesMax: 14 },
  { axis: "size", name: "Large", priceCents: 7400, sortOrder: 2, diameterIn: '10"', shape: "round", tiers: 1, servesMin: 18, servesMax: 22 },
  { axis: "size", name: "XL Two-Tier", priceCents: 11000, sortOrder: 3, diameterIn: '12"', shape: "round", tiers: 2, servesMin: 30, servesMax: 36 },

  // cake types — placeholder starter set, no equivalent existed in the old app
  { axis: "cake_type", name: "Classic Layer Cake", priceCents: 0, sortOrder: 0 },
  { axis: "cake_type", name: "Carlotta", priceCents: 500, sortOrder: 1 },
  { axis: "cake_type", name: "Naked Cake", priceCents: 800, sortOrder: 2 },
  { axis: "cake_type", name: "Sheet Cake", priceCents: -500, sortOrder: 3 },

  // flavors (ported from old `flavors`)
  { axis: "flavor", name: "Chocolate", priceCents: 0, sortOrder: 0 },
  { axis: "flavor", name: "Vanilla", priceCents: 0, sortOrder: 1 },
  { axis: "flavor", name: "Red Velvet", priceCents: 400, sortOrder: 2 },
  { axis: "flavor", name: "Marble", priceCents: 300, sortOrder: 3 },

  // fillings (ported from old `fillings`)
  { axis: "filling", name: "Strawberry Jam", priceCents: 300, sortOrder: 0 },
  { axis: "filling", name: "Chocolate Ganache", priceCents: 400, sortOrder: 1 },
  { axis: "filling", name: "Vanilla Cream", priceCents: 200, sortOrder: 2 },
  { axis: "filling", name: "Lemon Curd", priceCents: 300, sortOrder: 3 },
  { axis: "filling", name: "Salted Caramel", priceCents: 400, sortOrder: 4 },
  { axis: "filling", name: "Cream Cheese", priceCents: 300, sortOrder: 5 },

  // frostings — placeholder starter set, no equivalent existed in the old app
  { axis: "frosting", name: "Buttercream", priceCents: 0, sortOrder: 0 },
  { axis: "frosting", name: "Cream Cheese Frosting", priceCents: 300, sortOrder: 1 },
  { axis: "frosting", name: "Fondant", priceCents: 900, sortOrder: 2 },
  { axis: "frosting", name: "Whipped Cream", priceCents: -200, sortOrder: 3 },

  // decorations (ported from old `decorations`, now single-select per axis)
  { axis: "decoration", name: "Sprinkles", priceCents: 200, sortOrder: 0 },
  { axis: "decoration", name: "Fresh Berries", priceCents: 500, sortOrder: 1 },
  { axis: "decoration", name: "Choco Drip", priceCents: 400, sortOrder: 2 },
  { axis: "decoration", name: "Sugar Flowers", priceCents: 600, sortOrder: 3 },
  { axis: "decoration", name: "Gold Leaf", priceCents: 800, sortOrder: 4 },
  { axis: "decoration", name: "Macarons", priceCents: 500, sortOrder: 5 },
];

function seed() {
  const existing = db.select().from(catalogItems).all();
  if (existing.length > 0) {
    console.log(`catalog_items already has ${existing.length} rows — skipping seed.`);
    return;
  }

  for (const item of seedItems) {
    db.insert(catalogItems)
      .values({
        axis: item.axis,
        name: item.name,
        priceCents: item.priceCents,
        sortOrder: item.sortOrder,
        diameterIn: item.diameterIn ?? null,
        shape: item.shape ?? null,
        tiers: item.tiers ?? null,
        servesMin: item.servesMin ?? null,
        servesMax: item.servesMax ?? null,
      })
      .run();
  }

  console.log(`Seeded ${seedItems.length} catalog items.`);
}

seed();
