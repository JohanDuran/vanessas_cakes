"use client";

import type { FieldDTO, FieldOptionDTO } from "../../../lib/order-types";
import { computeOptionDeltaCents } from "../../../lib/pricing";
import PriceDelta from "../PriceDelta";
import ShapeDiagram from "./ShapeDiagram";

type Props = {
  field: FieldDTO;
  options: FieldOptionDTO[];
  selectedIds: number[];
  onToggle: (optionId: number) => void;
};

export default function FieldOptionStep({ field, options, selectedIds, onToggle }: Props) {
  const showDiagram = field.hasShapeDiagram;
  const isMulti = field.type === "multi_select";
  const selectedSet = new Set(selectedIds);

  // single_select shows the cost of swapping to this option from whatever's
  // currently picked; multi_select has no single "current" to swap from, so
  // it just shows the flat cost of adding it (ignored once selected, since
  // PriceDelta renders "Selected" instead of a price for selected options)
  const deltaFor = (item: FieldOptionDTO) =>
    isMulti ? item.priceCents : computeOptionDeltaCents(item.id, selectedIds[0], options);

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
                <PriceDelta cents={deltaFor(item)} selected={isSelected} />
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
              <PriceDelta cents={deltaFor(item)} selected={isSelected} />
            </button>
          );
        })}
        {options.length === 0 && <p>No options available with the current selections.</p>}
      </div>
    </div>
  );
}
