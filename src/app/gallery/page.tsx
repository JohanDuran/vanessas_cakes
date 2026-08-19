import { loadOrderData } from "../../db/queries";
import { getHiddenOptionIds } from "../../lib/constraints";
import { SIZE_FIELD_SLUG } from "../../lib/fields";
import type { FieldDTO, FieldOptionDTO, DesignSummaryDTO } from "../../lib/order-types";
import type { Answers } from "../../lib/pricing";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import GalleryCard from "../../components/order/GalleryCard";
import "./gallery.css";

export const dynamic = "force-dynamic";

/** Cheapest and priciest total for this design across every size the customer
 *  could actually pick — sizes excluded by a constraint against the design's
 *  other (fixed) base selections, or excluded specifically for this design,
 *  are left out of the range entirely. Custom fields never affect the range
 *  shown here, matching the base "sticker price" the gallery card advertises. */
function priceRangeForDesign(
  design: DesignSummaryDTO,
  allFields: FieldDTO[],
  options: FieldOptionDTO[],
  pairs: { optionAId: number; optionBId: number }[]
) {
  const sizeField = allFields.find((f) => f.slug === SIZE_FIELD_SLUG);
  const otherBaseFieldIds = new Set(
    allFields.filter((f) => f.isBase && f.id !== sizeField?.id).map((f) => f.id)
  );
  const optionById = new Map(options.map((o) => [o.id, o]));

  const otherAnswers: Answers = {};
  for (const [fieldIdStr, answer] of Object.entries(design.fieldValues)) {
    const fieldId = Number(fieldIdStr);
    if (otherBaseFieldIds.has(fieldId)) otherAnswers[fieldId] = answer;
  }

  const basePriceCents = Object.values(otherAnswers).reduce((sum, answer) => {
    if (answer.type !== "options") return sum;
    return sum + answer.optionIds.reduce((s, id) => s + (optionById.get(id)?.priceCents ?? 0), 0);
  }, 0);

  if (!sizeField) {
    const total = basePriceCents + design.premiumCents;
    return { minPriceCents: total, maxPriceCents: total };
  }

  const sizeAnswer = design.fieldValues[sizeField.id];
  const currentSizeId = sizeAnswer?.type === "options" ? sizeAnswer.optionIds[0] : undefined;

  // size is fixed (not just filtered) when this design locks the size field —
  // the customer never gets to change it, so there's no range to show
  if (design.lockedFieldIds.includes(sizeField.id)) {
    const fixed = currentSizeId != null ? optionById.get(currentSizeId) : undefined;
    const total = basePriceCents + (fixed?.priceCents ?? 0) + design.premiumCents;
    return { minPriceCents: total, maxPriceCents: total };
  }

  const hiddenSizeIds = getHiddenOptionIds(sizeField.id, otherAnswers, pairs);
  const excludedIds = new Set(design.excludedOptionIds);
  const sizes = options.filter(
    (o) => o.fieldId === sizeField.id && !hiddenSizeIds.has(o.id) && !excludedIds.has(o.id)
  );

  if (sizes.length === 0) {
    const fallback = currentSizeId != null ? optionById.get(currentSizeId) : undefined;
    const total = basePriceCents + (fallback?.priceCents ?? 0) + design.premiumCents;
    return { minPriceCents: total, maxPriceCents: total };
  }

  const totals = sizes.map((s) => basePriceCents + s.priceCents + design.premiumCents);
  return { minPriceCents: Math.min(...totals), maxPriceCents: Math.max(...totals) };
}

export default async function GalleryPage() {
  const { fields, options, designSummaries, constraintPairsDTO } = await loadOrderData();

  return (
    <>
      <Navbar />
      <header className="gallery-hero">
        <div className="container">
          <span className="section-eyebrow">Fan Favorites</span>
          <h1>A little taste of what we bake</h1>
          <p>Every cake below started as a custom order — tap one to make it yours.</p>
        </div>
      </header>

      <section className="gallery-section">
        <div className="container">
          <div className="gallery__grid">
            {designSummaries.map((design) => {
              const { minPriceCents, maxPriceCents } = priceRangeForDesign(
                design,
                fields,
                options,
                constraintPairsDTO
              );
              return (
                <GalleryCard
                  key={design.id}
                  design={design}
                  minPriceCents={minPriceCents}
                  maxPriceCents={maxPriceCents}
                />
              );
            })}
            {designSummaries.length === 0 && (
              <p className="gallery__empty">New designs are on their way — check back soon!</p>
            )}
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
