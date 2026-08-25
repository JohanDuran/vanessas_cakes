import type { ReviewDTO } from "../../db/queries";
import StarRating from "./StarRating";

export default function ReviewList({ reviews }: { reviews: ReviewDTO[] }) {
  if (reviews.length === 0) {
    return <p className="review-list__empty">No reviews yet — be the first to share your thoughts!</p>;
  }

  return (
    <ul className="review-list">
      {reviews.map((review) => (
        <li key={review.id} className="review-list__item">
          <div className="review-list__header">
            <strong className="review-list__name">{review.userName}</strong>
            <StarRating rating={review.rating} size="sm" />
            <span className="review-list__date">
              {new Date(review.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
          {review.comment && <p className="review-list__comment">{review.comment}</p>}
          {review.adminReply && (
            <div className="review-list__reply">
              <strong>Reply from Vanessa&apos;s Cakes</strong>
              <p>{review.adminReply}</p>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
