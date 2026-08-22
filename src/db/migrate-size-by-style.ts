// One-off data migration for the "size scoped by cake style" feature. Safe
// to re-run — every step is guarded. Delete this file once every
// environment that needs it has run it.
//
// Before: `size` options were shared across Standard/Tall (Tall was priced
// via a flat surcharge on the cake_style option), and Tiered cakes used two
// separate fields (`tier_levels` + `tier_size`).
//
// After: `size` is the one field for every style. Its options are tagged
// field_options.style_kind = "standard" | "tall" | "tiered" — standard/tall
// are independently-priced plain molds, tiered options are the old
// `tier_size` presets repointed onto this field. `tier_levels`/`tier_size`
// are retired (is_base=false, active=false) but never deleted, since
// historical order_selections rows may still reference them.
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  fields,
  fieldOptions,
  fieldOptionDimensions,
  designFieldValues,
  designLockedFields,
} from "./schema";

function run() {
  const sizeField = db.select().from(fields).where(eq(fields.slug, "size")).get();
  if (!sizeField) throw new Error('size field not found — run "npm run db:seed" first.');

  const cakeStyleField = db.select().from(fields).where(eq(fields.slug, "cake_style")).get();
  const tierLevelsField = db.select().from(fields).where(eq(fields.slug, "tier_levels")).get();
  const tierSizeField = db.select().from(fields).where(eq(fields.slug, "tier_size")).get();

  // Step 1+2: tag existing `size` options "standard", clone each active one
  // (dimensions included) as an independently-priced "tall" option. Guarded
  // on styleKind already being set, so this whole block is a no-op on a
  // second run.
  const sizeOptions = db.select().from(fieldOptions).where(eq(fieldOptions.fieldId, sizeField.id)).all();
  const untaggedSizeOptions = sizeOptions.filter((o) => o.styleKind == null);
  if (untaggedSizeOptions.length > 0) {
    db.transaction((tx) => {
      for (const opt of untaggedSizeOptions) {
        tx.update(fieldOptions).set({ styleKind: "standard", updatedAt: Date.now() }).where(eq(fieldOptions.id, opt.id)).run();
        const cloned = tx
          .insert(fieldOptions)
          .values({
            fieldId: sizeField.id,
            name: opt.name,
            priceCents: opt.priceCents,
            active: opt.active,
            sortOrder: opt.sortOrder,
            styleKind: "tall",
            updatedAt: Date.now(),
          })
          .returning({ id: fieldOptions.id })
          .get();

        const dims = tx.select().from(fieldOptionDimensions).where(eq(fieldOptionDimensions.fieldOptionId, opt.id)).get();
        if (dims) {
          tx.insert(fieldOptionDimensions)
            .values({
              fieldOptionId: cloned.id,
              diameterIn: dims.diameterIn,
              shape: dims.shape,
              tiers: dims.tiers,
              servesMin: dims.servesMin,
              servesMax: dims.servesMax,
              updatedAt: Date.now(),
            })
            .run();
        }
      }
    });
    console.log(`Tagged ${untaggedSizeOptions.length} size options "standard" and cloned them (with dimensions) as "tall".`);
  } else {
    console.log("size options already tagged by style — skipping steps 1-2.");
  }

  // Step 2b: backfill dimensions for tall options that were already cloned
  // by an earlier run of this script, before it copied dimensions.
  const tallOptions = db
    .select()
    .from(fieldOptions)
    .where(eq(fieldOptions.fieldId, sizeField.id))
    .all()
    .filter((o) => o.styleKind === "tall");
  const standardByName = new Map(
    db
      .select()
      .from(fieldOptions)
      .where(eq(fieldOptions.fieldId, sizeField.id))
      .all()
      .filter((o) => o.styleKind === "standard")
      .map((o) => [o.name, o])
  );
  let backfilledDims = 0;
  for (const tallOpt of tallOptions) {
    const hasDims = db.select().from(fieldOptionDimensions).where(eq(fieldOptionDimensions.fieldOptionId, tallOpt.id)).get();
    if (hasDims) continue;
    const standardOpt = standardByName.get(tallOpt.name);
    if (!standardOpt) continue;
    const dims = db.select().from(fieldOptionDimensions).where(eq(fieldOptionDimensions.fieldOptionId, standardOpt.id)).get();
    if (!dims) continue;
    db.insert(fieldOptionDimensions)
      .values({
        fieldOptionId: tallOpt.id,
        diameterIn: dims.diameterIn,
        shape: dims.shape,
        tiers: dims.tiers,
        servesMin: dims.servesMin,
        servesMax: dims.servesMax,
        updatedAt: Date.now(),
      })
      .run();
    backfilledDims++;
  }
  if (backfilledDims > 0) console.log(`Backfilled dimensions for ${backfilledDims} previously-cloned tall size option(s).`);

  // Step 3: repoint tier_size's option rows onto the size field, tag "tiered".
  if (tierSizeField) {
    const tierSizeOptions = db.select().from(fieldOptions).where(eq(fieldOptions.fieldId, tierSizeField.id)).all();
    if (tierSizeOptions.length > 0) {
      db.transaction((tx) => {
        for (const opt of tierSizeOptions) {
          tx.update(fieldOptions)
            .set({ fieldId: sizeField.id, styleKind: "tiered", updatedAt: Date.now() })
            .where(eq(fieldOptions.id, opt.id))
            .run();
        }
      });
      console.log(`Repointed ${tierSizeOptions.length} tier_size options onto size, tagged "tiered".`);
    } else {
      console.log("No tier_size options to repoint.");
    }

    // Step 4: repoint any design defaults/locks that pointed at tier_size.
    const repointedValues = db
      .update(designFieldValues)
      .set({ fieldId: sizeField.id })
      .where(eq(designFieldValues.fieldId, tierSizeField.id))
      .run();
    const repointedLocks = db
      .update(designLockedFields)
      .set({ fieldId: sizeField.id })
      .where(eq(designLockedFields.fieldId, tierSizeField.id))
      .run();
    if (repointedValues.changes || repointedLocks.changes) {
      console.log(
        `Repointed ${repointedValues.changes} design_field_values and ${repointedLocks.changes} design_locked_fields rows from tier_size to size.`
      );
    }
  }

  // Step 5: drop any design defaults/locks that pointed at tier_levels —
  // level count is implicit in the chosen tiered size option now.
  if (tierLevelsField) {
    const droppedValues = db.delete(designFieldValues).where(eq(designFieldValues.fieldId, tierLevelsField.id)).run();
    const droppedLocks = db.delete(designLockedFields).where(eq(designLockedFields.fieldId, tierLevelsField.id)).run();
    if (droppedValues.changes || droppedLocks.changes) {
      console.log(
        `Dropped ${droppedValues.changes} design_field_values and ${droppedLocks.changes} design_locked_fields rows for tier_levels.`
      );
    }
  }

  // Step 6: for any design whose live cake_style default is Tall, remap its
  // `size` default to the matching new "tall" clone (by name).
  if (cakeStyleField) {
    const tallStyleOption = db
      .select()
      .from(fieldOptions)
      .where(eq(fieldOptions.fieldId, cakeStyleField.id))
      .all()
      .find((o) => o.styleKind === "tall");
    const tallDesigns = tallStyleOption
      ? db
          .select()
          .from(designFieldValues)
          .where(eq(designFieldValues.fieldId, cakeStyleField.id))
          .all()
          .filter((r) => r.fieldOptionId === tallStyleOption.id)
      : [];

    if (tallDesigns.length > 0) {
      const currentSizeOptions = db.select().from(fieldOptions).where(eq(fieldOptions.fieldId, sizeField.id)).all();
      const tallOptionIdByName = new Map(
        currentSizeOptions.filter((o) => o.styleKind === "tall").map((o) => [o.name, o.id])
      );
      let remapped = 0;
      db.transaction((tx) => {
        for (const row of tallDesigns) {
          const sizeAnswer = tx
            .select()
            .from(designFieldValues)
            .where(eq(designFieldValues.designId, row.designId))
            .all()
            .find((r) => r.fieldId === sizeField.id && r.fieldOptionId != null);
          if (!sizeAnswer) continue;
          const currentOption = currentSizeOptions.find((o) => o.id === sizeAnswer.fieldOptionId);
          if (!currentOption || currentOption.styleKind === "tall") continue; // already remapped or unknown
          const tallOptionId = tallOptionIdByName.get(currentOption.name);
          if (!tallOptionId) continue;
          tx.update(designFieldValues).set({ fieldOptionId: tallOptionId }).where(eq(designFieldValues.id, sizeAnswer.id)).run();
          remapped++;
        }
      });
      if (remapped > 0) console.log(`Remapped ${remapped} Tall-styled design(s)' size default to the new Tall size options.`);
    }
  }

  // Step 7: retire tier_levels/tier_size from the customer/admin flow —
  // never delete, historical order_selections rows may still FK-reference them.
  if (tierLevelsField && (tierLevelsField.isBase || tierLevelsField.active)) {
    db.update(fields).set({ isBase: false, active: false, updatedAt: Date.now() }).where(eq(fields.id, tierLevelsField.id)).run();
    console.log("Retired tier_levels field (is_base=false, active=false).");
  }
  if (tierSizeField && (tierSizeField.isBase || tierSizeField.active)) {
    db.update(fields).set({ isBase: false, active: false, updatedAt: Date.now() }).where(eq(fields.id, tierSizeField.id)).run();
    console.log("Retired tier_size field (is_base=false, active=false).");
  }

  console.log("Migration complete.");
}

run();
