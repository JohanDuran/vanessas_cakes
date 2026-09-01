"use client";

import type { FieldDTO } from "../../../lib/order-types";
import { formatCentsDelta } from "../../../lib/pricing";

type Props = {
  field: FieldDTO;
  value: boolean | undefined;
  /** this field's price if the customer opts in — either its flat price for
   *  this design, or (if this design made it size-varying) its price at
   *  whichever `size` is currently answered elsewhere in the order */
  priceCents: number;
  onChange: (value: boolean) => void;
};

/** A per_size field's wizard step — a plain opt-in/opt-out, priced either
 *  flat or per the design's currently-selected size (see OrderWizard's
 *  currentSizeOptionId). */
export default function ToggleFieldStep({ field, value, priceCents, onChange }: Props) {
  return (
    <div className="wizard-step">
      <h2>
        {field.name}
        {field.required && " *"}
      </h2>
      <div className="option-grid">
        <button
          type="button"
          className={`option-card ${value === true ? "option-card--selected" : ""}`}
          onClick={() => onChange(true)}
        >
          <span className="option-card__name">Yes, add this</span>
          <span className={`price-delta ${priceCents === 0 ? "price-delta--zero" : "price-delta--up"}`}>
            {formatCentsDelta(priceCents)}
          </span>
        </button>
        <button
          type="button"
          className={`option-card ${value === false ? "option-card--selected" : ""}`}
          onClick={() => onChange(false)}
        >
          <span className="option-card__name">No, thanks</span>
        </button>
      </div>
    </div>
  );
}
