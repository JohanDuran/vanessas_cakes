"use client";

import { useCallback, useState } from "react";

type Props = {
  photos: string[];
  alt: string;
};

export default function DesignPhotoCarousel({ photos, alt }: Props) {
  const [index, setIndex] = useState(0);

  const goTo = useCallback(
    (i: number) => setIndex((i + photos.length) % photos.length),
    [photos.length]
  );

  if (photos.length === 0) {
    return (
      <div className="photo-carousel photo-carousel--empty">
        <span>🎂</span>
      </div>
    );
  }

  return (
    <div className="photo-carousel">
      <div className="photo-carousel__stage">
        <img src={`/uploads/${photos[index]}`} alt={alt} />

        {photos.length > 1 && (
          <>
            <button
              type="button"
              className="photo-carousel__nav photo-carousel__nav--prev"
              onClick={() => goTo(index - 1)}
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              type="button"
              className="photo-carousel__nav photo-carousel__nav--next"
              onClick={() => goTo(index + 1)}
              aria-label="Next photo"
            >
              ›
            </button>
          </>
        )}
      </div>

      {photos.length > 1 && (
        <div className="photo-carousel__dots">
          {photos.map((photo, i) => (
            <button
              key={photo}
              type="button"
              className={`photo-carousel__dot ${i === index ? "is-active" : ""}`}
              onClick={() => goTo(i)}
              aria-label={`Show photo ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
