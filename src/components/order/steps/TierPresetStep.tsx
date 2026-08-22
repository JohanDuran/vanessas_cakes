"use client";

import type { FieldDTO, FieldOptionDTO, TierPresetDTO } from "../../../lib/order-types";
import { totalServesForPreset } from "../../../lib/cakeStyle";
import { computeOptionDeltaCents } from "../../../lib/pricing";
import PriceDelta from "../PriceDelta";
import TierStackDiagram from "./TierStackDiagram";

type Props = {
  field: FieldDTO;
  /** already filtered to the current tier-count answer */
  options: FieldOptionDTO[];
  presetsByOptionId: Map<number, TierPresetDTO>;
  selectedIds: number[];
  /** custom-cake quotes don't have fixed pricing yet, so no prices are shown */
  hidePrice?: boolean;
  onToggle: (optionId: number) => void;
};

export default function TierPresetStep({
  field,
  options,
  presetsByOptionId,
  selectedIds,
  hidePrice,
  onToggle,
}: Props) {
  const selectedSet = new Set(selectedIds);
  const deltaFor = (item: FieldOptionDTO) => computeOptionDeltaCents(item.id, selectedIds[0], options);

  return (
    <div className="wizard-step">
      <h2>{field.name}</h2>
      <p className="wizard-step__hint">Each preset is a pre-built stack of molds, base to top.</p>
      <div className="size-grid">
        {options.map((item) => {
          const isSelected = selectedSet.has(item.id);
          const preset = presetsByOptionId.get(item.id);
          const serves = preset ? totalServesForPreset(preset) : { min: null, max: null };
          return (
            <button
              key={item.id}
              type="button"
              className={`size-card ${isSelected ? "size-card--selected" : ""}`}
              onClick={() => onToggle(item.id)}
            >
              <TierStackDiagram levels={preset?.levels ?? []} />
              <span className="size-card__name">{item.name}</span>
              <span className="size-card__meta">{preset?.levels.map((l) => l.moldName).join(" → ") ?? "—"}</span>
              {(serves.min || serves.max) && (
                <span className="size-card__serves">
                  Serves {serves.min ?? "?"}–{serves.max ?? "?"}
                </span>
              )}
              {!hidePrice && <PriceDelta cents={deltaFor(item)} selected={isSelected} />}
            </button>
          );
        })}
        {options.length === 0 && <p>No tier sizes available for this tier count yet.</p>}
      </div>
    </div>
  );
}
