"use client";

import type { FieldDTO } from "../../../lib/order-types";
import PriceDelta from "../PriceDelta";

type Props = {
  field: FieldDTO;
  value: string;
  /** whether this design requires an answer — see DesignSummaryDTO.requiredFieldIds */
  required: boolean;
  onChange: (value: string) => void;
};

export default function TextFieldStep({ field, value, required, onChange }: Props) {
  return (
    <div className="wizard-step">
      <div className="wizard-step__heading">
        <h2>
          {field.name}
          {required && " *"}
        </h2>
        <PriceDelta cents={field.additionalPriceCents} />
      </div>
      <div className="wizard-field">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${field.name.toLowerCase()}`}
          autoFocus
        />
      </div>
    </div>
  );
}
