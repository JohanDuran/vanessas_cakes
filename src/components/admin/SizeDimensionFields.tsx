"use client";

import { useState } from "react";
import { CAKE_SHAPES, CAKE_SHAPE_LABELS, isCakeShape, type CakeShape } from "../../lib/fields";

type Props = {
  formId?: string;
  compact?: boolean;
  defaultShape?: string | null;
  defaultDiameterIn?: number | null;
  defaultWidthIn?: number | null;
  defaultLengthIn?: number | null;
};

/** Shape-aware size inputs for a size field_option: a circle takes a
 *  diameter, square/rectangle take a width and a length — the field that
 *  doesn't apply is hidden rather than shown as an unused text box. Which
 *  pair is *visible* here is just UX; sizeMeta() in catalog/actions.ts is
 *  what actually decides which value(s) get saved, from the submitted
 *  shape. Plain numbers only — the `"` shown elsewhere is display-only. */
export default function SizeDimensionFields({
  formId,
  compact = false,
  defaultShape,
  defaultDiameterIn,
  defaultWidthIn,
  defaultLengthIn,
}: Props) {
  const [shape, setShape] = useState<CakeShape>(
    defaultShape && isCakeShape(defaultShape) ? defaultShape : "circle"
  );
  const isCircle = shape === "circle";

  const shapeSelect = (
    <select
      form={formId}
      name="shape"
      value={shape}
      onChange={(e) => setShape(e.target.value as CakeShape)}
      style={{ minWidth: compact ? 100 : 130 }}
    >
      {CAKE_SHAPES.map((s) => (
        <option key={s} value={s}>
          {CAKE_SHAPE_LABELS[s]}
        </option>
      ))}
    </select>
  );

  const numberInput = (name: string, defaultValue: number | null | undefined, placeholder: string) => (
    <input
      form={formId}
      name={name}
      type="number"
      step="0.25"
      min="0"
      defaultValue={defaultValue ?? ""}
      placeholder={placeholder}
      style={{ width: compact ? 64 : 80 }}
    />
  );

  const dims = isCircle ? (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {numberInput("diameterIn", defaultDiameterIn, "8")}
      <span style={{ color: "var(--text-soft)", fontSize: "0.8rem" }}>in diameter</span>
    </span>
  ) : (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {numberInput("widthIn", defaultWidthIn, "8")}
      <span style={{ color: "var(--text-soft)", fontSize: "0.8rem" }}>×</span>
      {numberInput("lengthIn", defaultLengthIn, "12")}
      <span style={{ color: "var(--text-soft)", fontSize: "0.8rem" }}>in</span>
    </span>
  );

  if (compact) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        {shapeSelect}
        {dims}
      </div>
    );
  }

  return (
    <>
      <div className="admin-field">
        <label>Shape</label>
        {shapeSelect}
      </div>
      <div className="admin-field">
        <label>{isCircle ? "Diameter" : "Width × Length"}</label>
        {dims}
      </div>
    </>
  );
}
