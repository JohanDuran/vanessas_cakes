import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import CakeIllustration from "./CakeIllustration";
import Donut from "./Donut";
import { slideshowCakes } from "../data/content";
import "./HeroSlideshow.css";

const AUTOPLAY_MS = 4500;

export default function HeroSlideshow() {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<number | null>(null);

  const goTo = useCallback((i: number) => {
    setIndex((i + slideshowCakes.length) % slideshowCakes.length);
  }, []);

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      setIndex((i) => (i + 1) % slideshowCakes.length);
    }, AUTOPLAY_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const active = slideshowCakes[index];

  return (
    <section className="hero">
      <div className="hero__blobs" aria-hidden="true">
        <span className="hero__blob hero__blob--1" />
        <span className="hero__blob hero__blob--2" />
        <span className="hero__blob hero__blob--3" />
      </div>

      <Donut className="hero__donut hero__donut--1" size={70} rotate={-10} />
      <Donut className="hero__donut hero__donut--2" size={54} rotate={18} />
      <Donut className="hero__donut hero__donut--3" size={46} rotate={30} />
      <Donut className="hero__donut hero__donut--4" size={64} rotate={-24} />

      <div className="container hero__inner">
        <div className="hero__copy">
          <span className="section-eyebrow">Freshly Baked Daily</span>
          <h1 className="hero__title">
            Cakes that taste as <span>sweet</span> as they look
          </h1>
          <p className="hero__subtitle">
            Handcrafted pastel cakes for birthdays, weddings, and everyday joy.
            Explore our favorites, or design your own from scratch.
          </p>
          <div className="hero__actions">
            <Link to="/customize" className="btn btn-primary">
              🎂 Design Your Cake
            </Link>
            <a href="#gallery" className="btn btn-outline">
              View Gallery
            </a>
          </div>
        </div>

        <div className="hero__stage">
          <div className="hero__stage-glow" aria-hidden="true" />
          <div className="hero__slide-frame">
            {slideshowCakes.map((cake, i) => (
              <div
                key={cake.id}
                className={`hero__slide ${i === index ? "hero__slide--active" : ""}`}
                aria-hidden={i !== index}
              >
                <CakeIllustration
                  flavor={cake.flavor}
                  icing={cake.icing}
                  icingSoft={cake.icingSoft}
                  topping={cake.topping}
                  tiers={cake.tiers}
                  size={300}
                />
              </div>
            ))}
          </div>

          <div className="hero__caption">
            <h3>{active.name}</h3>
            <p>{active.description}</p>
          </div>

          <button className="hero__nav hero__nav--prev" onClick={prev} aria-label="Previous cake">
            ‹
          </button>
          <button className="hero__nav hero__nav--next" onClick={next} aria-label="Next cake">
            ›
          </button>

          <div className="hero__dots">
            {slideshowCakes.map((cake, i) => (
              <button
                key={cake.id}
                className={`hero__dot ${i === index ? "hero__dot--active" : ""}`}
                onClick={() => goTo(i)}
                aria-label={`Show ${cake.name}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
