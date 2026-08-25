"use client";

import { useState } from "react";
import "./CakeDetailCarousel.css";

type Props = {
  photos: string[];
  alt: string;
};

/** Photo carousel for the cake detail ("Learn More") page only — deliberately
 *  its own component/classes, separate from order/DesignPhotoCarousel used in
 *  the order wizard, so styling changes here never bleed into that page
 *  (plain CSS classes are global, so a shared name would collide). */
export default function CakeDetailCarousel({ photos, alt }: Props) {
  const [index, setIndex] = useState(0);
  const hasPhotos = photos.length > 0;

  const goTo = (i: number) => setIndex((i + photos.length) % photos.length);

  return (
    <div className="cake-detail-carousel">
      <div className="cake-detail-carousel__frame">
        {hasPhotos ? (
          <img
            src={`/uploads/${photos[index]}`}
            alt={`${alt} — photo ${index + 1}`}
            className="cake-detail-carousel__image"
          />
        ) : (
          <div className="cake-detail-carousel__placeholder">🎂</div>
        )}

        {photos.length > 1 && (
          <>
            <button
              type="button"
              className="cake-detail-carousel__nav cake-detail-carousel__nav--prev"
              onClick={() => goTo(index - 1)}
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              type="button"
              className="cake-detail-carousel__nav cake-detail-carousel__nav--next"
              onClick={() => goTo(index + 1)}
              aria-label="Next photo"
            >
              ›
            </button>
          </>
        )}
      </div>

      {photos.length > 1 && (
        <div className="cake-detail-carousel__dots">
          {photos.map((photo, i) => (
            <button
              key={photo}
              type="button"
              className={`cake-detail-carousel__dot ${i === index ? "is-active" : ""}`}
              onClick={() => goTo(i)}
              aria-label={`Show photo ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
