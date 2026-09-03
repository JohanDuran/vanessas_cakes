export type Dimensions = {
  diameterIn: number | null;
  widthIn: number | null;
  lengthIn: number | null;
  shape: string | null;
};

/** Numbers are stored plain (no unit) — this is the one place `"` gets
 *  appended, for display only. `'8" round'`, `'8" × 12"'`. */
export function formatDimensions(dims: Dimensions | null | undefined): string | null {
  if (!dims) return null;
  if (dims.shape === "circle" && dims.diameterIn != null) {
    return `${dims.diameterIn}" round`;
  }
  if ((dims.shape === "square" || dims.shape === "rectangle") && dims.widthIn != null && dims.lengthIn != null) {
    return `${dims.widthIn}" × ${dims.lengthIn}"`;
  }
  return null;
}
