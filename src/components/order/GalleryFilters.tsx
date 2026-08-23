"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CategoryDTO, DesignSummaryDTO } from "../../lib/order-types";
import GalleryCard from "./GalleryCard";

type CardData = { design: DesignSummaryDTO; minPriceCents: number; maxPriceCents: number };

type Props = {
  cards: CardData[];
  categories: CategoryDTO[];
};

export default function GalleryFilters({ cards, categories }: Props) {
  // multiple chips can be active at once — a design shows if it belongs to
  // ANY of the selected categories (not all), same as a typical tag filter
  const [activeCategoryIds, setActiveCategoryIds] = useState<Set<number>>(new Set());

  const usedCategories = useMemo(
    () => categories.filter((c) => cards.some((card) => card.design.categoryIds.includes(c.id))),
    [categories, cards]
  );

  const toggleCategory = (categoryId: number) => {
    setActiveCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const visibleCards = useMemo(
    () =>
      activeCategoryIds.size === 0
        ? cards
        : cards.filter((card) => card.design.categoryIds.some((id) => activeCategoryIds.has(id))),
    [cards, activeCategoryIds]
  );

  return (
    <>
      {usedCategories.length > 0 && (
        <div className="gallery-categories">
          <button
            type="button"
            className={`gallery-category-chip${activeCategoryIds.size === 0 ? " is-active" : ""}`}
            onClick={() => setActiveCategoryIds(new Set())}
          >
            All
          </button>
          {usedCategories.map((category) => (
            <button
              type="button"
              key={category.id}
              className={`gallery-category-chip${activeCategoryIds.has(category.id) ? " is-active" : ""}`}
              aria-pressed={activeCategoryIds.has(category.id)}
              onClick={() => toggleCategory(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}
      <div className="gallery__grid">
        {activeCategoryIds.size === 0 && (
          <Link href="/order/custom" className="gallery-card gallery-card--custom">
            <div className="gallery-card__art gallery-card__art--custom">
              <div className="gallery-card__placeholder">✨</div>
            </div>
            <h3>Custom Cake</h3>
            <p>Don&apos;t see what you&apos;re after? Tell us your vision and get a free quote.</p>
            <div className="gallery-card__footer">
              <span className="btn btn-primary gallery-card__cta">Start a Custom Order</span>
            </div>
          </Link>
        )}
        {visibleCards.map(({ design, minPriceCents, maxPriceCents }) => (
          <GalleryCard key={design.id} design={design} minPriceCents={minPriceCents} maxPriceCents={maxPriceCents} />
        ))}
        {cards.length === 0 && <p className="gallery__empty">New designs are on their way — check back soon!</p>}
        {cards.length > 0 && visibleCards.length === 0 && (
          <p className="gallery__empty">No designs in this category yet.</p>
        )}
      </div>
    </>
  );
}
