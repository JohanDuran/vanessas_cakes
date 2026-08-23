"use client";

import { useMemo, useState } from "react";
import type { CategoryDTO, DesignSummaryDTO } from "../../lib/order-types";
import GalleryCard from "./GalleryCard";

type CardData = { design: DesignSummaryDTO; minPriceCents: number; maxPriceCents: number };

type Props = {
  cards: CardData[];
  categories: CategoryDTO[];
};

export default function GalleryFilters({ cards, categories }: Props) {
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);

  const usedCategories = useMemo(
    () => categories.filter((c) => cards.some((card) => card.design.categoryIds.includes(c.id))),
    [categories, cards]
  );

  const visibleCards = useMemo(
    () =>
      activeCategoryId == null ? cards : cards.filter((card) => card.design.categoryIds.includes(activeCategoryId)),
    [cards, activeCategoryId]
  );

  return (
    <>
      {usedCategories.length > 0 && (
        <div className="gallery-categories">
          <button
            type="button"
            className={`gallery-category-chip${activeCategoryId === null ? " is-active" : ""}`}
            onClick={() => setActiveCategoryId(null)}
          >
            All
          </button>
          {usedCategories.map((category) => (
            <button
              type="button"
              key={category.id}
              className={`gallery-category-chip${activeCategoryId === category.id ? " is-active" : ""}`}
              onClick={() => setActiveCategoryId(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}
      <div className="gallery__grid">
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
