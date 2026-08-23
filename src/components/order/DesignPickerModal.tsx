"use client";

import { useMemo, useState } from "react";
import type { FieldDTO, FieldOptionDTO, DesignSummaryDTO, TierPresetDTO, CategoryDTO } from "../../lib/order-types";
import { formatCents, priceRangeForDesign } from "../../lib/pricing";
import type { ConstraintPair } from "../../lib/constraints";

type Props = {
  designs: DesignSummaryDTO[];
  fields: FieldDTO[];
  options: FieldOptionDTO[];
  constraintPairs: ConstraintPair[];
  tierPresets: TierPresetDTO[];
  categories: CategoryDTO[];
  onSelect: (design: DesignSummaryDTO) => void;
  onSelectCustom: () => void;
  onClose?: () => void;
  closable?: boolean;
};

export default function DesignPickerModal({
  designs,
  fields,
  options,
  constraintPairs,
  tierPresets,
  categories,
  onSelect,
  onSelectCustom,
  onClose,
  closable,
}: Props) {
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);

  // only offer chips for categories at least one published design actually uses
  const usedCategories = useMemo(
    () => categories.filter((c) => designs.some((d) => d.categoryIds.includes(c.id))),
    [categories, designs]
  );

  const visibleDesigns = useMemo(
    () => (activeCategoryId == null ? designs : designs.filter((d) => d.categoryIds.includes(activeCategoryId))),
    [designs, activeCategoryId]
  );

  return (
    <div className="design-modal-overlay">
      <div className="design-modal">
        <div className="design-modal__header">
          <div>
            <span className="section-eyebrow">Step 1</span>
            <h2>Choose Your Design</h2>
          </div>
          {closable && (
            <button type="button" className="design-modal__close" onClick={onClose} aria-label="Close">
              ×
            </button>
          )}
        </div>
        {usedCategories.length > 0 && (
          <div className="design-modal__categories">
            <button
              type="button"
              className={`design-category-chip${activeCategoryId === null ? " is-active" : ""}`}
              onClick={() => setActiveCategoryId(null)}
            >
              All
            </button>
            {usedCategories.map((category) => (
              <button
                type="button"
                key={category.id}
                className={`design-category-chip${activeCategoryId === category.id ? " is-active" : ""}`}
                onClick={() => setActiveCategoryId(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>
        )}
        <div className="design-modal__grid">
          {activeCategoryId === null && (
            <button type="button" className="design-card design-card--custom" onClick={onSelectCustom}>
              <div className="design-card__art design-card__art--custom">
                <div className="design-card__placeholder">✨</div>
              </div>
              <span className="design-card__name">Custom Cake</span>
              <span className="design-card__price">Tell us your vision — get a free quote</span>
            </button>
          )}
          {visibleDesigns.map((design) => {
            const { minPriceCents, maxPriceCents } = priceRangeForDesign(
              design,
              fields,
              options,
              constraintPairs,
              tierPresets
            );
            const priceLabel =
              minPriceCents === maxPriceCents
                ? formatCents(minPriceCents)
                : `${formatCents(minPriceCents)} – ${formatCents(maxPriceCents)}`;
            return (
              <button key={design.id} type="button" className="design-card" onClick={() => onSelect(design)}>
                <div className="design-card__art">
                  {design.photos[0] ? (
                    <img src={`/uploads/${design.photos[0]}`} alt={design.name} />
                  ) : (
                    <div className="design-card__placeholder">🎂</div>
                  )}
                </div>
                <span className="design-card__name">{design.name}</span>
                <span className="design-card__price">{priceLabel}</span>
              </button>
            );
          })}
          {designs.length === 0 && (
            <p className="design-modal__empty">No designs published yet — check back soon!</p>
          )}
          {designs.length > 0 && visibleDesigns.length === 0 && (
            <p className="design-modal__empty">No designs in this category yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
