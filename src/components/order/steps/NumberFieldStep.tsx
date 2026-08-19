"use client";

import type { FieldDTO } from "../../../lib/order-types";

type Props = {
  field: FieldDTO;
  value: string;
  onChange: (value: string) => void;
};

export default function NumberFieldStep({ field, value, onChange }: Props) {
  return (
    <div className="wizard-step">
      <h2>{field.name}</h2>
      <div className="wizard-field">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${field.name.toLowerCase()}`}
          autoFocus
        />
      </div>
    </div>
  );
}
