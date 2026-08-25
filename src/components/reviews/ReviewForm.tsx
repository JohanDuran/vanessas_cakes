"use client";

import { useActionState } from "react";
import { submitReview } from "../../lib/reviews/actions";
import StarRatingInput from "./StarRatingInput";

type Props = {
  designId: number;
  existing: { rating: number; comment: string | null } | null;
};

export default function ReviewForm({ designId, existing }: Props) {
  const [state, formAction, isSubmitting] = useActionState(submitReview, undefined);

  return (
    <form action={formAction} className="review-form">
      <input type="hidden" name="designId" value={designId} />

      <label>Your rating</label>
      <StarRatingInput name="rating" defaultValue={existing?.rating ?? 0} />

      <label htmlFor="comment">Your comment (optional)</label>
      <textarea
        id="comment"
        name="comment"
        rows={4}
        maxLength={2000}
        placeholder="Tell us what you thought of this design..."
        defaultValue={existing?.comment ?? ""}
      />

      {state && "error" in state && <p className="review-form__error">{state.error}</p>}
      {state && "success" in state && (
        <p className="review-form__success">Thanks for your review!</p>
      )}

      <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : existing ? "Update Review" : "Submit Review"}
      </button>
    </form>
  );
}
