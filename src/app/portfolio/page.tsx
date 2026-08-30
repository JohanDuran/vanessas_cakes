import { asc } from "drizzle-orm";
import { db } from "../../db";
import { portfolioPhotos } from "../../db/schema";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import PortfolioCard from "../../components/order/PortfolioCard";
import "./portfolio.css";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const photos = await db
    .select()
    .from(portfolioPhotos)
    .orderBy(asc(portfolioPhotos.sortOrder), asc(portfolioPhotos.createdAt));

  return (
    <>
      <Navbar />
      <header className="portfolio-hero">
        <div className="container">
          <span className="section-eyebrow">Inspiration</span>
          <h1>Our Portfolio</h1>
          <p>Fell in love with a photo? Get a quote and we&apos;ll bring it to life for you.</p>
        </div>
      </header>

      <section className="portfolio-section">
        <div className="container">
          <div className="portfolio__grid">
            {photos.map((photo) => (
              <PortfolioCard key={photo.id} id={photo.id} path={photo.path} />
            ))}
            {photos.length === 0 && (
              <p className="portfolio__empty">No portfolio photos yet — check back soon!</p>
            )}
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
