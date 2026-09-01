"use client";

import { type ReactNode } from "react";
import type { FieldDTO, FieldOptionDTO, DesignSummaryDTO, TierPresetDTO } from "../../lib/order-types";
import {
  computeTotalCents,
  formatCents,
  resolveFieldPriceCents,
  resolveOptionPriceCents,
  resolvePriceableFields,
  type Answers,
} from "../../lib/pricing";
import PriceDelta from "./PriceDelta";

type Props = {
  design: DesignSummaryDTO;
  designFields: FieldDTO[];
  answers: Answers;
  /** already resolved for this design — see OrderWizard's resolvedOptions */
  options: FieldOptionDTO[];
  /** the design's currently-answered `size` option, if any — per_size
   *  fields this design made size-varying price off this */
  currentSizeOptionId?: number;
  tierPresets: TierPresetDTO[];
  lockedFieldIds: Set<number>;
  isCustom: boolean;
  referenceImages: File[];
  lockedReferenceImagePath?: string | null;
  isEditingCartItem: boolean;
  onAddToCart: () => void;
  onEditStep: (fieldId: number) => void;
  onEditCustom: () => void;
};

export default function OrderSummaryPanel({
  design,
  designFields,
  answers,
  options,
  currentSizeOptionId,
  tierPresets,
  lockedFieldIds,
  isCustom,
  referenceImages,
  lockedReferenceImagePath,
  isEditingCartItem,
  onAddToCart,
  onEditStep,
  onEditCustom,
}: Props) {
  const optionById = new Map(options.map((o) => [o.id, o]));
  const presetsByOptionId = new Map(tierPresets.map((p) => [p.fieldOptionId, p]));
  const flatOptions = options.map((o) => ({ id: o.id, fieldId: o.fieldId, priceCents: o.priceCents }));
  const flatFields = resolvePriceableFields(
    design,
    designFields.map((f) => ({ id: f.id, additionalPriceCents: f.additionalPriceCents }))
  );
  const total = computeTotalCents(
    answers,
    flatOptions,
    flatFields,
    design.perSizeFieldPrices,
    design.optionSizePrices,
    currentSizeOptionId
  );

  return (
    <div className="wizard-step order-summary">
      <h2>Review Your Cake</h2>
      <p className="order-summary__design">
        <strong>{design.name}</strong>
      </p>

      <ul className="order-summary__list">
        {designFields.map((field) => {
          const answer = answers[field.id];
          let valueLabel = "—";
          let priceNode: ReactNode = null;
          if (answer?.type === "options") {
            const names = answer.optionIds
              .map((id) => {
                const opt = optionById.get(id);
                if (!opt) return null;
                const preset = presetsByOptionId.get(id);
                if (!preset || preset.levels.length === 0) return opt.name;
                return `${opt.name} (${preset.levels.map((l) => l.moldName).join(" → ")})`;
              })
              .filter((name): name is string => Boolean(name));
            valueLabel = names.length > 0 ? names.join(", ") : "—";
            if (names.length > 0 && !isCustom) {
              const priceCents = answer.optionIds.reduce(
                (sum, id) => sum + (resolveOptionPriceCents(id, flatOptions, design.optionSizePrices, currentSizeOptionId) ?? 0),
                0
              );
              priceNode = formatCents(priceCents);
            }
          } else if (answer?.type === "text") {
            valueLabel = answer.value || "—";
            if (answer.value && !isCustom) {
              priceNode = <PriceDelta cents={resolveFieldPriceCents(field.id, flatFields)} />;
            }
          } else if (answer?.type === "number") {
            valueLabel = String(answer.value);
            if (!isCustom) priceNode = <PriceDelta cents={resolveFieldPriceCents(field.id, flatFields)} />;
          } else if (answer?.type === "toggle") {
            valueLabel = answer.value ? "Yes" : "No";
            if (answer.value && !isCustom) {
              priceNode = (
                <PriceDelta
                  cents={resolveFieldPriceCents(field.id, flatFields, design.perSizeFieldPrices, currentSizeOptionId)}
                />
              );
            }
          }
          return (
            <li key={field.id}>
              <span className="order-summary__axis">{field.name}</span>
              <span className="order-summary__item">{valueLabel}</span>
              <span className="order-summary__item-price">{priceNode}</span>
              {!lockedFieldIds.has(field.id) && (
                <button type="button" className="order-summary__edit" onClick={() => onEditStep(field.id)}>
                  Change
                </button>
              )}
            </li>
          );
        })}
        {isCustom && (
          <li>
            <span className="order-summary__axis">Reference images</span>
            <span className="order-summary__item">
              {lockedReferenceImagePath
                ? "1 from your Portfolio pick"
                : referenceImages.length > 0
                  ? `${referenceImages.length} attached`
                  : "None"}
            </span>
            <span className="order-summary__item-price" />
            <button type="button" className="order-summary__edit" onClick={onEditCustom}>
              Change
            </button>
          </li>
        )}
      </ul>

      {!isCustom && (
        <div className="order-summary__total">
          <span>Total</span>
          <strong>{formatCents(total)}</strong>
        </div>
      )}
      {isCustom && (
        <p className="wizard-step__hint">We'll follow up with your exact quote within 24 hours.</p>
      )}

      <button type="button" className="btn btn-primary order-summary__submit" onClick={onAddToCart}>
        {isEditingCartItem ? "Save Changes" : isCustom ? "Add Custom Quote to Cart" : "Add to Cart"}
      </button>
    </div>
  );
}
