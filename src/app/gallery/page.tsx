import { loadOrderData } from "../../db/queries";
import { priceRangeForDesign } from "../../lib/pricing";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import GalleryFilters from "../../components/order/GalleryFilters";
import "./gallery.css";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const { fields, options, designSummaries, constraintPairsDTO, tierPresets, categories } = await loadOrderData();

  const cards = designSummaries.map((design) => ({
    design,
    ...priceRangeForDesign(design, fields, options, constraintPairsDTO, tierPresets),
  }));

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
          <GalleryFilters cards={cards} categories={categories} />
        </div>
      </section>
      <Footer />
    </>
  );
}
