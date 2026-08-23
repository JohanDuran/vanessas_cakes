"use client";

import type { FieldDTO } from "../../../lib/order-types";
import PriceDelta from "../PriceDelta";

type Props = {
  field: FieldDTO;
  value: string;
  onChange: (value: string) => void;
};

export default function TextFieldStep({ field, value, onChange }: Props) {
  return (
    <div className="wizard-step">
      <div className="wizard-step__heading">
        <h2>
          {field.name}
          {field.required && " *"}
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
