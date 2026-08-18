import Link from "next/link";
import { loadOrderData } from "../db/queries";
import { AXES, type Axis } from "../lib/axes";
import Reveal from "./Reveal";
import GalleryCard from "./order/GalleryCard";
import "./GallerySection.css";

export default async function GallerySection() {
  const { items, designSummaries } = await loadOrderData();
  const sizes = items.filter((i) => i.axis === "size");
  const itemById = new Map(items.map((i) => [i.id, i]));

  const nonSizeAxes = AXES.filter((a) => a !== "size") as Axis[];

  return (
    <section id="gallery" className="gallery">
      <div className="container">
        <Reveal className="gallery__head">
          <span className="section-eyebrow">Fan Favorites</span>
          <h2>A little taste of what we bake</h2>
          <p>Pick a size to see the price update, then tap through to make it yours.</p>
        </Reveal>

        <div className="gallery__grid">
          {designSummaries.map((design) => {
            const basePriceCents = nonSizeAxes.reduce((sum, axis) => {
              const itemId = design.recipe[axis];
              const item = itemId != null ? itemById.get(itemId) : undefined;
              return sum + (item?.priceCents ?? 0);
            }, 0);
            return (
              <GalleryCard key={design.id} design={design} sizes={sizes} basePriceCents={basePriceCents} />
            );
          })}
          {designSummaries.length === 0 && (
            <p style={{ color: "var(--text-soft)" }}>New designs are on their way — check back soon!</p>
          )}
        </div>

        <div className="gallery__cta">
          <Link href="/order" className="btn btn-primary">
            Start Designing Yours
          </Link>
        </div>
      </div>
    </section>
  );
}
