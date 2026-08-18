"use client";

import { AXIS_LABELS, type Axis } from "../../../lib/axes";
import type { CatalogItemDTO } from "../../../lib/order-types";
import { computeAxisDeltaCents } from "../../../lib/pricing";
import PriceDelta from "../PriceDelta";

type Props = {
  axis: Axis;
  options: CatalogItemDTO[];
  selectedId: number | undefined;
  onSelect: (id: number) => void;
};

export default function AxisOptionStep({ axis, options, selectedId, onSelect }: Props) {
  return (
    <div className="wizard-step">
      <h2>{AXIS_LABELS[axis]}</h2>
      <div className="option-grid">
        {options.map((item) => {
          const delta = computeAxisDeltaCents(item.id, selectedId, options);
          const isSelected = item.id === selectedId;
          return (
            <button
              key={item.id}
              type="button"
              className={`option-card ${isSelected ? "option-card--selected" : ""}`}
              onClick={() => onSelect(item.id)}
            >
              <span className="option-card__name">{item.name}</span>
              <PriceDelta cents={delta} selected={isSelected} />
            </button>
          );
        })}
        {options.length === 0 && <p>No options available with the current selections.</p>}
      </div>
    </div>
  );
}
