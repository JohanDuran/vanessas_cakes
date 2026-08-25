import { notFound } from "next/navigation";
import Link from "next/link";
import { loadOrderData, loadReviewsForDesign, getCurrentUser } from "../../../db/queries";
import { priceRangeForDesign, formatCents } from "../../../lib/pricing";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import CakeDetailCarousel from "../../../components/CakeDetailCarousel";
import StarRating from "../../../components/reviews/StarRating";
import ReviewForm from "../../../components/reviews/ReviewForm";
import ReviewList from "../../../components/reviews/ReviewList";
import "../gallery.css";
import "../../../components/reviews/reviews.css";
import "./design-detail.css";

export const dynamic = "force-dynamic";

export default async function DesignDetailPage({ params }: { params: Promise<{ designId: string }> }) {
  const { designId } = await params;
  const id = Number(designId);
  if (!Number.isInteger(id)) notFound();

  const [{ fields, options, designSummaries, constraintPairsDTO, tierPresets }, reviews, user] = await Promise.all([
    loadOrderData(),
    loadReviewsForDesign(id),
    getCurrentUser(),
  ]);

  const design = designSummaries.find((d) => d.id === id);
  if (!design) notFound();

  const { minPriceCents, maxPriceCents } = priceRangeForDesign(
    design,
    fields,
    options,
    constraintPairsDTO,
    tierPresets
  );
  const priceLabel =
    minPriceCents === maxPriceCents
      ? formatCents(minPriceCents)
      : `${formatCents(minPriceCents)} – ${formatCents(maxPriceCents)}`;

  const averageRating =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  const myReview = user ? (reviews.find((r) => r.userId === user.id) ?? null) : null;

  return (
    <>
      <Navbar />
      <main className="design-detail">
        <div className="container design-detail__gallery">
          <CakeDetailCarousel photos={design.photos} alt={design.name} />
        </div>

        <div className="container design-detail__content">
          <div className="design-detail__info">
            <span className="section-eyebrow">Cake Design</span>
            <h1>{design.name}</h1>
            {reviews.length > 0 && (
              <div className="design-detail__rating">
                <StarRating rating={averageRating} />
                <span>
                  {averageRating.toFixed(1)} ({reviews.length} review{reviews.length === 1 ? "" : "s"})
                </span>
              </div>
            )}
            {design.description && <p className="design-detail__description">{design.description}</p>}
            <div className="design-detail__price">{priceLabel}</div>
            <Link href={`/order/${design.id}`} className="btn btn-primary">
              Order This
            </Link>
          </div>

          <div className="design-detail__reviews">
            <h2>Reviews</h2>
            <ReviewList reviews={reviews} />
          </div>

          <div className="review-form__wrap">
            {user ? (
              <>
                <h3>{myReview ? "Edit your review" : "Leave a review"}</h3>
                <ReviewForm designId={design.id} existing={myReview} />
              </>
            ) : (
              <p className="review-form__login-prompt">
                <Link href={`/account/login?next=/gallery/${design.id}`}>Log in</Link> to leave a review.
              </p>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
