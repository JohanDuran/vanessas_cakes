"use client";

import { useScrollReveal } from "../hooks/useScrollReveal";
import { reviews } from "../data/content";
import "./ReviewsSection.css";

export default function ReviewsSection() {
  const headRef = useScrollReveal<HTMLDivElement>();

  return (
    <section id="reviews" className="reviews">
      <div className="container">
        <div ref={headRef} className="reviews__head reveal">
          <span className="section-eyebrow">Sweet Words</span>
          <h2>Loved by our customers</h2>
        </div>

        <div className="reviews__grid">
          {reviews.map((r, i) => (
            <ReviewCard key={r.id} review={r} delay={i % 3} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ReviewCard({ review, delay }: { review: (typeof reviews)[number]; delay: number }) {
  const ref = useScrollReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`review-card reveal reveal-delay-${delay}`}>
      <div className="review-card__stars" aria-label={`${review.rating} out of 5 stars`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={i < review.rating ? "star star--filled" : "star"}>
            ★
          </span>
        ))}
      </div>
      <p className="review-card__text">&ldquo;{review.text}&rdquo;</p>
      <div className="review-card__footer">
        <div className="review-card__avatar">{review.name.charAt(0)}</div>
        <div>
          <strong>{review.name}</strong>
          <span>Ordered the {review.cake}</span>
        </div>
      </div>
    </div>
  );
}
