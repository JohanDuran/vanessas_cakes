import { formatCentsDelta } from "../../lib/pricing";

export default function PriceDelta({ cents, selected }: { cents: number; selected?: boolean }) {
  if (selected) return <span className="price-delta price-delta--selected">Selected</span>;
  const positive = cents > 0;
  const negative = cents < 0;
  return (
    <span
      className={`price-delta ${positive ? "price-delta--up" : negative ? "price-delta--down" : "price-delta--zero"}`}
    >
      {formatCentsDelta(cents)}
    </span>
  );
}
