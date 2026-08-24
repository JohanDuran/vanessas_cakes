"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import CakeIllustration from "./CakeIllustration";
import Donut from "./Donut";
import { slideshowCakes } from "../data/content";
import type { FeaturedDesignDTO } from "../db/queries";
import { formatCents } from "../lib/pricing";
import "./HeroSlideshow.css";

const AUTOPLAY_MS = 4500;

type Props = {
  /** Admin's curated pick (designs.featured) — real catalog cakes with
   *  photos, each linking straight to its order page. Falls back to the
   *  static illustrated slides below when the admin hasn't featured any
   *  design yet, so the homepage is never empty. */
  featured?: FeaturedDesignDTO[];
};

export default function HeroSlideshow({ featured = [] }: Props) {
  const usingFeatured = featured.length > 0;
  const slideCount = usingFeatured ? featured.length : slideshowCakes.length;

  const [index, setIndex] = useState(0);
  const timerRef = useRef<number | null>(null);

  const goTo = useCallback((i: number) => {
    setIndex((i + slideCount) % slideCount);
  }, [slideCount]);

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      setIndex((i) => (i + 1) % slideCount);
    }, AUTOPLAY_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [slideCount]);

  const activeFeatured = usingFeatured ? featured[index] : null;
  const active = usingFeatured ? null : slideshowCakes[index];

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
            <Link href="/gallery" className="btn btn-primary">
              🎂 Design Your Cake
            </Link>
          </div>
        </div>

        <div className="hero__stage">
          <div className="hero__stage-glow" aria-hidden="true" />
          <div className="hero__slide-frame">
            {usingFeatured
              ? featured.map((cake, i) => (
                  <Link
                    key={cake.id}
                    href={`/order/${cake.id}`}
                    className={`hero__slide hero__slide--photo ${i === index ? "hero__slide--active" : ""}`}
                    aria-hidden={i !== index}
                  >
                    {cake.photo ? (
                      <img src={`/uploads/${cake.photo}`} alt={cake.name} />
                    ) : (
                      <div className="hero__slide-placeholder">🎂</div>
                    )}
                  </Link>
                ))
              : slideshowCakes.map((cake, i) => (
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
            <h3>{activeFeatured ? activeFeatured.name : active!.name}</h3>
            <p>
              {activeFeatured
                ? (activeFeatured.description ?? formatCents(activeFeatured.chargedPriceCents))
                : active!.description}
            </p>
          </div>

          <button className="hero__nav hero__nav--prev" onClick={prev} aria-label="Previous cake">
            ‹
          </button>
          <button className="hero__nav hero__nav--next" onClick={next} aria-label="Next cake">
            ›
          </button>

          <div className="hero__dots">
            {(usingFeatured ? featured : slideshowCakes).map((cake, i) => (
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
