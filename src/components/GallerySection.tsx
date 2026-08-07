import { Link } from "react-router-dom";
import { useScrollReveal } from "../hooks/useScrollReveal";
import CakeIllustration from "./CakeIllustration";
import { galleryCakes } from "../data/content";
import "./GallerySection.css";

export default function GallerySection() {
  const headRef = useScrollReveal<HTMLDivElement>();

  return (
    <section id="gallery" className="gallery">
      <div className="container">
        <div ref={headRef} className="gallery__head reveal">
          <span className="section-eyebrow">Fan Favorites</span>
          <h2>A little taste of what we bake</h2>
          <p>Every cake below started as a custom order — yours could be next.</p>
        </div>

        <div className="gallery__grid">
          {galleryCakes.map((cake, i) => (
            <GalleryCard key={cake.id} cake={cake} delay={i % 3} />
          ))}
        </div>

        <div className="gallery__cta">
          <Link to="/customize" className="btn btn-primary">
            Start Designing Yours
          </Link>
        </div>
      </div>
    </section>
  );
}

function GalleryCard({
  cake,
  delay,
}: {
  cake: (typeof galleryCakes)[number];
  delay: number;
}) {
  const ref = useScrollReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`gallery__card reveal reveal-delay-${delay}`}>
      <div className="gallery__card-art">
        <CakeIllustration
          flavor={cake.flavor}
          icing={cake.icing}
          icingSoft={cake.icingSoft}
          topping={cake.topping}
          tiers={cake.tiers}
          size={190}
        />
      </div>
      <h3>{cake.name}</h3>
      <p>{cake.description}</p>
    </div>
  );
}
