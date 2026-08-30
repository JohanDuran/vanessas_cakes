"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

type Props = {
  id: number;
  path: string;
};

/** Inspiration-only photo card for the Portfolio page — deliberately shows no
 *  price or description (see GalleryCard for the priced-design equivalent).
 *  Clicking the photo opens it full-size in a lightbox. "Get a Quote" hands
 *  the photo id to the Custom Cake wizard as its locked reference image —
 *  see /order/custom's portfolioPhotoId handling. */
export default function PortfolioCard({ id, path }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxOpen]);

  return (
    <div className="portfolio-card">
      <button
        type="button"
        className="portfolio-card__art"
        onClick={() => setLightboxOpen(true)}
        aria-label="View full-size photo"
      >
        <img src={path} alt="" />
      </button>
      <Link href={`/order/custom?portfolioPhotoId=${id}`} className="btn btn-primary portfolio-card__cta">
        Get a Quote
      </Link>

      {lightboxOpen &&
        createPortal(
          <div className="portfolio-lightbox" onClick={() => setLightboxOpen(false)}>
            <button
              type="button"
              className="portfolio-lightbox__close"
              aria-label="Close"
              onClick={() => setLightboxOpen(false)}
            >
              ×
            </button>
            <img src={path} alt="" onClick={(e) => e.stopPropagation()} />
          </div>,
          document.body
        )}
    </div>
  );
}
