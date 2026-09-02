"use client";

import type { FieldDTO, FieldOptionDTO, TierPresetDTO } from "../../../lib/order-types";
import {
  formatCents,
  resolveFieldPriceCents,
  resolveOptionPriceCents,
  type Answers,
  type PerSizePrices,
} from "../../../lib/pricing";
import PriceDelta from "../PriceDelta";

type Props = {
  field: FieldDTO;
  answer: Answers[number] | undefined;
  /** this design's own resolved options for this field (flat price already
   *  folded in) — same list FieldOptionStep would've received for this field */
  options: FieldOptionDTO[];
  presetsByOptionId?: Map<number, TierPresetDTO>;
  perSizeFieldPrices?: PerSizePrices;
  optionSizePrices?: PerSizePrices;
  currentSizeOptionId?: number;
  /** custom-cake quotes don't have fixed pricing yet, so no price is shown */
  hidePrice?: boolean;
};

/** A locked field's step — the customer can't change this, but (unlike a
 *  hidden field) they should still see what it is instead of it silently
 *  never appearing until Review. Read-only version of FieldOptionStep /
 *  TextFieldStep / NumberFieldStep / ToggleFieldStep, picking a display
 *  based on the design's own fixed answer instead of taking input. */
export default function LockedFieldStep({
  field,
  answer,
  options,
  presetsByOptionId,
  perSizeFieldPrices,
  optionSizePrices,
  currentSizeOptionId,
  hidePrice,
}: Props) {
  const optionById = new Map(options.map((o) => [o.id, o]));
  const flatOptions = options.map((o) => ({ id: o.id, fieldId: o.fieldId, priceCents: o.priceCents }));
  const flatFields = [{ id: field.id, additionalPriceCents: field.additionalPriceCents }];

  let valueLabel = "Not set for this design";
  let priceNode: React.ReactNode = null;

  if (answer?.type === "options") {
    const names = answer.optionIds
      .map((id) => {
        const opt = optionById.get(id);
        if (!opt) return null;
        const preset = presetsByOptionId?.get(id);
        if (!preset || preset.levels.length === 0) return opt.name;
        return `${opt.name} (${preset.levels.map((l) => l.moldName).join(" → ")})`;
      })
      .filter((name): name is string => Boolean(name));
    if (names.length > 0) {
      valueLabel = names.join(", ");
      if (!hidePrice) {
        const priceCents = answer.optionIds.reduce(
          (sum, id) => sum + (resolveOptionPriceCents(id, flatOptions, optionSizePrices, currentSizeOptionId) ?? 0),
          0
        );
        priceNode = formatCents(priceCents);
      }
    }
  } else if (answer?.type === "text") {
    valueLabel = answer.value || "Not set for this design";
    if (answer.value && !hidePrice) priceNode = <PriceDelta cents={resolveFieldPriceCents(field.id, flatFields)} />;
  } else if (answer?.type === "number") {
    valueLabel = String(answer.value);
    if (!hidePrice) priceNode = <PriceDelta cents={resolveFieldPriceCents(field.id, flatFields)} />;
  } else if (answer?.type === "toggle") {
    valueLabel = answer.value ? "Yes" : "No";
    if (answer.value && !hidePrice) {
      priceNode = (
        <PriceDelta cents={resolveFieldPriceCents(field.id, flatFields, perSizeFieldPrices, currentSizeOptionId)} />
      );
    }
  }

  return (
    <div className="wizard-step">
      <div className="wizard-step__heading">
        <h2>{field.name}</h2>
      </div>
      <p className="wizard-step__hint">🔒 Fixed for this design — you can&apos;t change this.</p>
      <div className="option-grid">
        <div className="option-card option-card--selected option-card--locked">
          <span className="option-card__name">{valueLabel}</span>
          {priceNode}
        </div>
      </div>
    </div>
  );
}
