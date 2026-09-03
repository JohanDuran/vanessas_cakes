"use client";

import type { FieldDTO, FieldOptionDTO } from "../../../lib/order-types";
import { computeOptionDeltaCents, formatCents, resolveOptionPriceCents, type PerSizePrices } from "../../../lib/pricing";
import { formatDimensions } from "../../../lib/dimensions";
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
  /** this design's size-varying option prices, if any of `options` here
   *  were made size-varying (see design_option_size_prices) — an option
   *  present here resolves to its price at `currentSizeOptionId` instead of
   *  its flat priceCents. Without these, a size-varying option would show
   *  its plain catalog price instead of $0/whatever this design actually
   *  charges at the customer's chosen size. */
  optionSizePrices?: PerSizePrices;
  currentSizeOptionId?: number;
  onToggle: (optionId: number) => void;
};

export default function FieldOptionStep({
  field,
  options,
  selectedIds,
  hidePrice,
  totalBaseCents,
  optionSizePrices,
  currentSizeOptionId,
  onToggle,
}: Props) {
  const showDiagram = field.hasShapeDiagram;
  const isMulti = field.type === "multi_select";
  const selectedSet = new Set(selectedIds);

  const resolvedPriceCents = (item: FieldOptionDTO) =>
    resolveOptionPriceCents(item.id, options, optionSizePrices, currentSizeOptionId) ?? item.priceCents;

  // single_select shows the cost of swapping to this option from whatever's
  // currently picked; multi_select has no single "current" to swap from, so
  // it just shows the flat cost of adding it (ignored once selected, since
  // PriceDelta renders "Selected" instead of a price for selected options)
  const deltaFor = (item: FieldOptionDTO) =>
    isMulti
      ? resolvedPriceCents(item)
      : computeOptionDeltaCents(item.id, selectedIds[0], options, optionSizePrices, currentSizeOptionId);

  const priceNodeFor = (item: FieldOptionDTO, isSelected: boolean) =>
    totalBaseCents != null ? (
      <span className="price-delta price-delta--total">{formatCents(totalBaseCents + resolvedPriceCents(item))}</span>
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
                  widthIn={dims?.widthIn ?? null}
                  lengthIn={dims?.lengthIn ?? null}
                  servesMin={dims?.servesMin ?? null}
                  servesMax={dims?.servesMax ?? null}
                />
                <span className="size-card__name">{item.name}</span>
                <span className="size-card__meta">
                  {formatDimensions(dims) ?? "—"}
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
