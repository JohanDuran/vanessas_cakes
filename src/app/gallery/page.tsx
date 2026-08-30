import { loadOrderData } from "../../db/queries";
import { priceRangeForDesign } from "../../lib/pricing";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import GalleryFilters from "../../components/order/GalleryFilters";
import "./gallery.css";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const { fields, options, designSummaries, constraintPairsDTO, tierPresets, categories } = await loadOrderData();

  const catalogDesigns = designSummaries.filter((d) => d.kind === "catalog");

  const cards = catalogDesigns.map((design) => ({
    design,
    ...priceRangeForDesign(design, fields, options, constraintPairsDTO, tierPresets),
  }));

  return (
    <>
      <Navbar />
      <header className="gallery-hero">
        <div className="container">
          <span className="section-eyebrow">Fan Favorites</span>
          <h1>Shop Our Collection</h1>
          <p>Enjoy our special selection of cakes.</p>
        </div>
      </header>

      <section className="gallery-section">
        <div className="container">
          <GalleryFilters cards={cards} categories={categories} />
        </div>
      </section>
      <Footer />
    </>
  );
}
