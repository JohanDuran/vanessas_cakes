type Props = {
  rating: number;
  size?: "sm" | "md";
};

/** Read-only 5-star display, rounded to the nearest whole star. */
export default function StarRating({ rating, size = "md" }: Props) {
  const rounded = Math.round(rating);
  return (
    <span className={`star-rating star-rating--${size}`} role="img" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < rounded ? "star-rating__star is-filled" : "star-rating__star"}>
          ★
        </span>
      ))}
    </span>
  );
}
