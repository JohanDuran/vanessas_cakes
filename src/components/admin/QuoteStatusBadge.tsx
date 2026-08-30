const LABEL: Record<string, string> = {
  new: "New",
  calculated: "Calculated",
  awaiting_confirmation: "Awaiting confirmation",
  accepted: "Accepted",
  rejected: "Rejected",
};

const COLOR: Record<string, string> = {
  new: "var(--text-soft)",
  calculated: "#b8860b",
  awaiting_confirmation: "#b8860b",
  accepted: "#1a7f37",
  rejected: "#c62828",
};

/** Small text badge for orders.quoteStatus — admin-only, so a plain colored
 *  label is enough; no need for the customer-facing polish of a pill/icon.
 *  See PaymentBadge.tsx, which this mirrors. */
export default function QuoteStatusBadge({ status }: { status: string }) {
  return (
    <span style={{ color: COLOR[status] ?? "var(--text-soft)", fontWeight: 600, whiteSpace: "nowrap" }}>
      {LABEL[status] ?? status}
    </span>
  );
}
