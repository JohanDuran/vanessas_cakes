import Link from "next/link";
import type { DesignSummaryDTO } from "../../lib/order-types";
import { formatCents } from "../../lib/pricing";

type Props = {
  design: DesignSummaryDTO;
  /** cheapest and priciest total across every size the customer could actually pick for this design */
  minPriceCents: number;
  maxPriceCents: number;
};

export default function GalleryCard({ design, minPriceCents, maxPriceCents }: Props) {
  const href = `/order/${design.id}`;
  const priceLabel =
    minPriceCents === maxPriceCents
      ? formatCents(minPriceCents)
      : `${formatCents(minPriceCents)} – ${formatCents(maxPriceCents)}`;

  return (
    <div className="gallery-card">
      <Link href={href} className="gallery-card__art">
        {design.photos[0] ? (
          <img src={`/uploads/${design.photos[0]}`} alt={design.name} />
        ) : (
          <div className="gallery-card__placeholder">🎂</div>
        )}
      </Link>
      <h3>
        <Link href={href}>{design.name}</Link>
      </h3>
      {design.description && <p>{design.description}</p>}

      <div className="gallery-card__footer">
        <div className="gallery-card__price">
          <span className="gallery-card__price-label">Price</span>
          <span className="gallery-card__price-value">{priceLabel}</span>
        </div>
        <Link href={href} className="btn btn-primary gallery-card__cta">
          Order This
        </Link>
      </div>
    </div>
  );
}
