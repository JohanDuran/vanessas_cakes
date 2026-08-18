"use client";

import { AXES, AXIS_LABELS, type Axis } from "../../lib/axes";
import type { CatalogItemDTO, DesignSummaryDTO } from "../../lib/order-types";
import { computeTotalCents, formatCents } from "../../lib/pricing";
import { submitOrder } from "../../app/order/actions";

type Props = {
  design: DesignSummaryDTO;
  selections: Partial<Record<Axis, number>>;
  items: CatalogItemDTO[];
  onEditStep: (axis: Axis) => void;
};

export default function OrderSummaryPanel({ design, selections, items, onEditStep }: Props) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const total = computeTotalCents(selections, design.premiumCents, items);

  return (
    <form action={submitOrder} className="wizard-step order-summary">
      <input type="hidden" name="designId" value={design.id} />
      {AXES.map((axis) => (
        <input key={axis} type="hidden" name={`selection_${axis}`} value={selections[axis] ?? ""} />
      ))}

      <h2>Review Your Cake</h2>
      <p className="order-summary__design">
        <strong>{design.name}</strong>
      </p>

      <ul className="order-summary__list">
        {AXES.map((axis) => {
          const item = selections[axis] != null ? byId.get(selections[axis]!) : undefined;
          return (
            <li key={axis}>
              <span className="order-summary__axis">{AXIS_LABELS[axis]}</span>
              <span className="order-summary__item">{item?.name ?? "—"}</span>
              <span className="order-summary__item-price">{item ? formatCents(item.priceCents) : ""}</span>
              <button type="button" className="order-summary__edit" onClick={() => onEditStep(axis)}>
                Change
              </button>
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
