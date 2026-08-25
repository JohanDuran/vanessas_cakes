import { loadAllReviewsForAdmin } from "../../../../db/queries";
import StarRating from "../../../../components/reviews/StarRating";
import "../../../../components/reviews/reviews.css";
import { replyToReview } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  const reviews = await loadAllReviewsForAdmin();

  return (
    <>
      <h1>Reviews</h1>
      <p className="admin-main__subtitle">
        Star ratings and comments customers left on cake designs. Reply to any of them — your reply
        shows right under the review on that cake&apos;s page.
      </p>

      {reviews.length === 0 ? (
        <div className="admin-card">
          <p>No reviews yet.</p>
        </div>
      ) : (
        reviews.map((review) => {
          const formId = `review-reply-${review.id}`;
          return (
            <div key={review.id} className="admin-card admin-review">
              <div className="admin-review__header">
                <span className="admin-review__design">{review.designName}</span>
                <StarRating rating={review.rating} size="sm" />
                <span className="admin-review__meta">
                  {review.userName} ({review.userEmail}) ·{" "}
                  {new Date(review.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>

              {review.comment && <p>{review.comment}</p>}

              {review.adminReply && (
                <div className="admin-review__reply">
                  <strong>Your reply</strong>
                  <p>{review.adminReply}</p>
                </div>
              )}

              <form id={formId} action={replyToReview} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input type="hidden" name="id" value={review.id} />
                <input type="hidden" name="designId" value={review.designId} />
                <textarea
                  name="reply"
                  className="admin-textarea"
                  rows={3}
                  maxLength={2000}
                  placeholder="Write a reply..."
                  defaultValue={review.adminReply ?? ""}
                />
                <button type="submit" className="admin-btn-sm admin-btn-sm--ghost" style={{ alignSelf: "flex-start" }}>
                  {review.adminReply ? "Update Reply" : "Post Reply"}
                </button>
              </form>
            </div>
          );
        })
      )}
    </>
  );
}
