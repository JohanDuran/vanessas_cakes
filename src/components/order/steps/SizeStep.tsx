"use client";

import type { CatalogItemDTO } from "../../../lib/order-types";
import { computeAxisDeltaCents } from "../../../lib/pricing";
import PriceDelta from "../PriceDelta";
import ShapeDiagram from "./ShapeDiagram";

type Props = {
  options: CatalogItemDTO[];
  selectedId: number | undefined;
  onSelect: (id: number) => void;
};

export default function SizeStep({ options, selectedId, onSelect }: Props) {
  return (
    <div className="wizard-step">
      <h2>Size</h2>
      <p className="wizard-step__hint">Shown with shape, diameter, and recommended servings.</p>
      <div className="size-grid">
        {options.map((item) => {
          const delta = computeAxisDeltaCents(item.id, selectedId, options);
          const isSelected = item.id === selectedId;
          return (
            <button
              key={item.id}
              type="button"
              className={`size-card ${isSelected ? "size-card--selected" : ""}`}
              onClick={() => onSelect(item.id)}
            >
              <ShapeDiagram shape={item.shape} tiers={item.tiers} />
              <span className="size-card__name">{item.name}</span>
              <span className="size-card__meta">
                {item.diameterIn ?? "—"}
                {item.tiers && item.tiers > 1 ? ` · ${item.tiers} tiers` : ""}
              </span>
              {(item.servesMin || item.servesMax) && (
                <span className="size-card__serves">
                  Serves {item.servesMin ?? "?"}–{item.servesMax ?? "?"}
                </span>
              )}
              <PriceDelta cents={delta} selected={isSelected} />
            </button>
          );
        })}
        {options.length === 0 && <p>No sizes available with the current selections.</p>}
      </div>
    </div>
  );
}
