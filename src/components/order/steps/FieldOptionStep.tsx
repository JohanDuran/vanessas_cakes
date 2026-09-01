"use client";

import type { FieldDTO, FieldOptionDTO } from "../../../lib/order-types";
import { computeOptionDeltaCents, formatCents } from "../../../lib/pricing";
import PriceDelta from "../PriceDelta";
import ShapeDiagram from "./ShapeDiagram";

type Props = {
  field: FieldDTO;
  options: FieldOptionDTO[];
  selectedIds: number[];
  /** custom-cake quotes don't have fixed pricing yet, so no prices are shown */
  hidePrice?: boolean;
  /** Size field only: everything else the customer has answered so far,
   *  priced up (including the design's premium) but excluding this field's
   *  own contribution — lets each card show its absolute total price
   *  (basePriceCents + that size's own price) instead of a +/- delta. */
  totalBaseCents?: number;
  onToggle: (optionId: number) => void;
};

export default function FieldOptionStep({ field, options, selectedIds, hidePrice, totalBaseCents, onToggle }: Props) {
  const showDiagram = field.hasShapeDiagram;
  const isMulti = field.type === "multi_select";
  const selectedSet = new Set(selectedIds);

  // single_select shows the cost of swapping to this option from whatever's
  // currently picked; multi_select has no single "current" to swap from, so
  // it just shows the flat cost of adding it (ignored once selected, since
  // PriceDelta renders "Selected" instead of a price for selected options)
  const deltaFor = (item: FieldOptionDTO) =>
    isMulti ? item.priceCents : computeOptionDeltaCents(item.id, selectedIds[0], options);

  const priceNodeFor = (item: FieldOptionDTO, isSelected: boolean) =>
    totalBaseCents != null ? (
      <span className="price-delta price-delta--total">{formatCents(totalBaseCents + item.priceCents)}</span>
    ) : (
      <PriceDelta cents={deltaFor(item)} selected={isSelected} />
    );

  if (showDiagram) {
    return (
      <div className="wizard-step">
        <h2>{field.name}</h2>
        <p className="wizard-step__hint">Shown with shape, diameter, and recommended servings.</p>
        <div className="size-grid">
          {options.map((item) => {
            const isSelected = selectedSet.has(item.id);
            const dims = item.dimensions;
            return (
              <button
                key={item.id}
                type="button"
                className={`size-card ${isSelected ? "size-card--selected" : ""}`}
                onClick={() => onToggle(item.id)}
              >
                <ShapeDiagram
                  shape={dims?.shape ?? null}
                  tiers={dims?.tiers ?? null}
                  diameterIn={dims?.diameterIn ?? null}
                  servesMin={dims?.servesMin ?? null}
                  servesMax={dims?.servesMax ?? null}
                />
                <span className="size-card__name">{item.name}</span>
                <span className="size-card__meta">
                  {dims?.diameterIn ?? "—"}
                  {dims?.tiers && dims.tiers > 1 ? ` · ${dims.tiers} tiers` : ""}
                </span>
                {(dims?.servesMin || dims?.servesMax) && (
                  <span className="size-card__serves">
                    Serves {dims?.servesMin ?? "?"}–{dims?.servesMax ?? "?"}
                  </span>
                )}
                {!hidePrice && priceNodeFor(item, isSelected)}
              </button>
            );
          })}
          {options.length === 0 && <p>No sizes available with the current selections.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="wizard-step">
      <h2>{field.name}</h2>
      <div className="option-grid">
        {options.map((item) => {
          const isSelected = selectedSet.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              className={`option-card ${isSelected ? "option-card--selected" : ""}`}
              onClick={() => onToggle(item.id)}
            >
              <span className="option-card__name">{item.name}</span>
              {!hidePrice && priceNodeFor(item, isSelected)}
            </button>
          );
        })}
        {options.length === 0 && <p>No options available with the current selections.</p>}
      </div>
    </div>
  );
}
