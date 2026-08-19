"use client";

import type { FieldDTO, FieldOptionDTO, DesignSummaryDTO } from "../../lib/order-types";
import { computeTotalCents, formatCents, type Answers } from "../../lib/pricing";
import { submitOrder } from "../../app/order/actions";

type Props = {
  design: DesignSummaryDTO;
  designFields: FieldDTO[];
  answers: Answers;
  options: FieldOptionDTO[];
  lockedFieldIds: Set<number>;
  onEditStep: (fieldId: number) => void;
};

export default function OrderSummaryPanel({
  design,
  designFields,
  answers,
  options,
  lockedFieldIds,
  onEditStep,
}: Props) {
  const optionById = new Map(options.map((o) => [o.id, o]));
  const flatOptions = options.map((o) => ({ id: o.id, fieldId: o.fieldId, priceCents: o.priceCents }));
  const total = computeTotalCents(answers, design.premiumCents, flatOptions);

  return (
    <form action={submitOrder} className="wizard-step order-summary">
      <input type="hidden" name="designId" value={design.id} />
      {designFields.map((field) => {
        const answer = answers[field.id];
        if (!answer) return null;
        if (answer.type === "options") {
          return answer.optionIds.map((optionId) => (
            <input key={`${field.id}-${optionId}`} type="hidden" name={`options_${field.id}`} value={optionId} />
          ));
        }
        if (answer.type === "text") {
          return <input key={field.id} type="hidden" name={`text_${field.id}`} value={answer.value} />;
        }
        return <input key={field.id} type="hidden" name={`number_${field.id}`} value={answer.value} />;
      })}

      <h2>Review Your Cake</h2>
      <p className="order-summary__design">
        <strong>{design.name}</strong>
      </p>

      <ul className="order-summary__list">
        {designFields.map((field) => {
          const answer = answers[field.id];
          let valueLabel = "—";
          let priceLabel = "";
          if (answer?.type === "options") {
            const names = answer.optionIds
              .map((id) => optionById.get(id)?.name)
              .filter((name): name is string => Boolean(name));
            valueLabel = names.length > 0 ? names.join(", ") : "—";
            if (names.length > 0) {
              const priceCents = answer.optionIds.reduce((sum, id) => sum + (optionById.get(id)?.priceCents ?? 0), 0);
              priceLabel = formatCents(priceCents);
            }
          } else if (answer?.type === "text") {
            valueLabel = answer.value || "—";
          } else if (answer?.type === "number") {
            valueLabel = String(answer.value);
          }
          return (
            <li key={field.id}>
              <span className="order-summary__axis">{field.name}</span>
              <span className="order-summary__item">{valueLabel}</span>
              <span className="order-summary__item-price">{priceLabel}</span>
              {!lockedFieldIds.has(field.id) && (
                <button type="button" className="order-summary__edit" onClick={() => onEditStep(field.id)}>
                  Change
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="order-summary__total">
        <span>Total</span>
        <strong>{formatCents(total)}</strong>
      </div>

      <div className="wizard-field">
        <label htmlFor="customerName">Your name</label>
        <input id="customerName" name="customerName" required />
      </div>
      <div className="wizard-field">
        <label htmlFor="customerEmail">Email</label>
        <input id="customerEmail" name="customerEmail" type="email" required />
      </div>
      <div className="wizard-field">
        <label htmlFor="customerPhone">Phone (optional)</label>
        <input id="customerPhone" name="customerPhone" type="tel" />
      </div>
      <div className="wizard-field">
        <label htmlFor="comments">Comments / special requests</label>
        <textarea id="comments" name="comments" rows={4} />
      </div>

      <button type="submit" className="btn btn-primary order-summary__submit">
        Send Order to the Baker
      </button>
    </form>
  );
}
