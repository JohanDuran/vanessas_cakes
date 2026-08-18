"use client";

import { useState } from "react";
import Link from "next/link";
import type { CatalogItemDTO, DesignSummaryDTO } from "../../lib/order-types";
import { formatCents } from "../../lib/pricing";

type Props = {
  design: DesignSummaryDTO;
  sizes: CatalogItemDTO[];
  /** sum of the design's recipe item prices across every axis EXCEPT size */
  basePriceCents: number;
};

export default function GalleryCard({ design, sizes, basePriceCents }: Props) {
  const defaultSizeId = design.recipe.size ?? sizes[0]?.id;
  const [sizeId, setSizeId] = useState<number | undefined>(defaultSizeId);

  const selectedSize = sizes.find((s) => s.id === sizeId);
  const total = basePriceCents + (selectedSize?.priceCents ?? 0) + design.premiumCents;

  const href = sizeId ? `/order/${design.id}?size=${sizeId}` : `/order/${design.id}`;

  return (
    <div className="gallery-card">
      <Link href={href} className="gallery-card__art">
        {design.photoPath ? (
          <img src={`/uploads/${design.photoPath}`} alt={design.name} />
        ) : (
          <div className="gallery-card__placeholder">🎂</div>
        )}
      </Link>
      <h3>{design.name}</h3>
      {design.description && <p>{design.description}</p>}

      {sizes.length > 0 && (
        <div className="gallery-card__size">
          <label htmlFor={`size-${design.id}`}>Size</label>
          <select
            id={`size-${design.id}`}
            value={sizeId ?? ""}
            onChange={(e) => setSizeId(Number(e.target.value) || undefined)}
          >
            {sizes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="gallery-card__footer">
        <span className="gallery-card__price">{formatCents(total)}</span>
        <Link href={href} className="btn btn-primary gallery-card__cta">
          Order This
        </Link>
      </div>
    </div>
  );
}
