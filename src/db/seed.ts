import { db } from "./index";
import { fields, fieldOptions, fieldOptionDimensions, tierPresets, tierPresetLevels } from "./schema";
import { BASE_FIELD_SLUGS, BASE_FIELD_LABELS, type BaseFieldSlug, type CakeStyleKind } from "../lib/fields";

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
  /** for cake_style's 3 fixed options, and for `size` options — which style
   *  (standard/tall/tiered) the size option belongs to. Tiered size options
   *  are seeded separately below as tier presets, not in this list. */
  styleKind?: CakeStyleKind;
};

// Ported from the old src/customize/data.ts (Vite app) plus placeholder
// starter rows for cake_type/frosting, which had no prior data — the owner
// should replace/expand these via /admin/catalog once the app ships.
const seedOptions: SeedOption[] = [
  // cake style — the 3 fixed values every design/order picks between. Its
  // own price is a flat style surcharge on top of whatever `size` option is
  // picked; here it's left at $0 since Tall pricing is fully expressed by
  // the independently-priced Tall size options below instead.
  { fieldSlug: "cake_style", name: "Standard", priceCents: 0, sortOrder: 0, styleKind: "standard" },
  { fieldSlug: "cake_style", name: "Tall", priceCents: 0, sortOrder: 1, styleKind: "tall" },
  { fieldSlug: "cake_style", name: "Tiered", priceCents: 0, sortOrder: 2, styleKind: "tiered" },

  // sizes (ported from old `sizes`, with shape/servings visual-aid metadata
  // added) — the atomic single-layer molds for Standard, also referenced
  // (never duplicated) as the building blocks of the tiered presets below.
  { fieldSlug: "size", name: "Small", priceCents: 3500, sortOrder: 0, diameterIn: '6"', shape: "round", tiers: 1, servesMin: 6, servesMax: 8, styleKind: "standard" },
  { fieldSlug: "size", name: "Medium", priceCents: 5200, sortOrder: 1, diameterIn: '8"', shape: "round", tiers: 1, servesMin: 10, servesMax: 14, styleKind: "standard" },
  { fieldSlug: "size", name: "Large", priceCents: 7400, sortOrder: 2, diameterIn: '10"', shape: "round", tiers: 1, servesMin: 18, servesMax: 22, styleKind: "standard" },
  { fieldSlug: "size", name: "Extra Large", priceCents: 9500, sortOrder: 3, diameterIn: '12"', shape: "round", tiers: 1, servesMin: 26, servesMax: 32, styleKind: "standard" },

  // Tall sizes — a separate, independently-priced catalog from Standard
  // (same starting names/dimensions, priced higher as a placeholder — the
  // owner should tune these via /admin/catalog once real costs are in).
  { fieldSlug: "size", name: "Small", priceCents: 5000, sortOrder: 0, diameterIn: '6"', shape: "round", tiers: 1, servesMin: 6, servesMax: 8, styleKind: "tall" },
  { fieldSlug: "size", name: "Medium", priceCents: 6700, sortOrder: 1, diameterIn: '8"', shape: "round", tiers: 1, servesMin: 10, servesMax: 14, styleKind: "tall" },
  { fieldSlug: "size", name: "Large", priceCents: 8900, sortOrder: 2, diameterIn: '10"', shape: "round", tiers: 1, servesMin: 18, servesMax: 22, styleKind: "tall" },
  { fieldSlug: "size", name: "Extra Large", priceCents: 11000, sortOrder: 3, diameterIn: '12"', shape: "round", tiers: 1, servesMin: 26, servesMax: 32, styleKind: "tall" },

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

async function seed() {
  const existing = await db.select().from(fields);
  if (existing.length > 0) {
    console.log(`fields already has ${existing.length} rows — skipping seed.`);
    return;
  }

  const fieldIdBySlug = new Map<string, number>();
  for (const [index, slug] of BASE_FIELD_SLUGS.entries()) {
    const inserted = await db
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
      .then((r) => r[0]);
    fieldIdBySlug.set(slug, inserted.id);
  }

  // standard-only, since tier presets are always built from the plain
  // (single-tier, Standard-styled) molds, never from Tall or other presets
  const standardMoldIdByName = new Map<string, number>();

  for (const opt of seedOptions) {
    const insertedOption = await db
      .insert(fieldOptions)
      .values({
        fieldId: fieldIdBySlug.get(opt.fieldSlug)!,
        name: opt.name,
        priceCents: opt.priceCents,
        sortOrder: opt.sortOrder,
        styleKind: opt.styleKind ?? null,
        updatedAt: Date.now(),
      })
      .returning({ id: fieldOptions.id })
      .then((r) => r[0]);

    if (opt.fieldSlug === "size" && opt.styleKind === "standard") {
      standardMoldIdByName.set(opt.name, insertedOption.id);
    }

    const hasDims =
      opt.diameterIn != null ||
      opt.shape != null ||
      opt.tiers != null ||
      opt.servesMin != null ||
      opt.servesMax != null;
    if (hasDims) {
      await db.insert(fieldOptionDimensions)
        .values({
          fieldOptionId: insertedOption.id,
          diameterIn: opt.diameterIn ?? null,
          shape: opt.shape ?? null,
          tiers: opt.tiers ?? null,
          servesMin: opt.servesMin ?? null,
          servesMax: opt.servesMax ?? null,
          updatedAt: Date.now(),
        })
        ;
    }
  }

  console.log(`Seeded ${BASE_FIELD_SLUGS.length} base fields and ${seedOptions.length} options.`);

  // Example tiered presets — `size` options tagged styleKind="tiered", each
  // an ordered stack of the Standard molds above. Base (widest) to top
  // (narrowest); treat these as a starting template and adjust via
  // /admin/catalog once real mold measurements are in.
  const sizeFieldId = fieldIdBySlug.get("size")!;
  const examplePresets: { name: string; priceCents: number; moldNames: string[] }[] = [
    { name: "Classic 2-Tier", priceCents: 9000, moldNames: ["Large", "Medium"] },
    { name: "Classic 3-Tier", priceCents: 13000, moldNames: ["Extra Large", "Large", "Medium"] },
    { name: "Classic 4-Tier", priceCents: 18000, moldNames: ["Extra Large", "Large", "Medium", "Small"] },
  ];
  for (const preset of examplePresets) {
    const insertedOption = await db
      .insert(fieldOptions)
      .values({
        fieldId: sizeFieldId,
        name: preset.name,
        priceCents: preset.priceCents,
        sortOrder: preset.moldNames.length,
        styleKind: "tiered",
        updatedAt: Date.now(),
      })
      .returning({ id: fieldOptions.id })
      .then((r) => r[0]);
    const insertedPreset = await db
      .insert(tierPresets)
      .values({ fieldOptionId: insertedOption.id, levelCount: preset.moldNames.length, updatedAt: Date.now() })
      .returning({ id: tierPresets.id })
      .then((r) => r[0]);
    for (const [index, moldName] of preset.moldNames.entries()) {
      await db.insert(tierPresetLevels).values({
        tierPresetId: insertedPreset.id,
        position: index + 1,
        moldOptionId: standardMoldIdByName.get(moldName)!,
      });
    }
  }
  console.log(`Seeded ${examplePresets.length} example tiered size presets.`);
}

await seed();
