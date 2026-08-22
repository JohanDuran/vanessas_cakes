import { loadOrderData } from "../../db/queries";
import { priceRangeForDesign } from "../../lib/pricing";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import GalleryCard from "../../components/order/GalleryCard";
import "./gallery.css";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const { fields, options, designSummaries, constraintPairsDTO, tierPresets } = await loadOrderData();

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
                constraintPairsDTO,
                tierPresets
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
