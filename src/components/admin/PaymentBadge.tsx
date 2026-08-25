const LABEL: Record<string, string> = {
  not_required: "—",
  pending: "Awaiting payment",
  paid: "Paid",
  failed: "Payment failed",
  expired: "Checkout expired",
};

const COLOR: Record<string, string> = {
  not_required: "var(--text-soft)",
  pending: "#b8860b",
  paid: "#1a7f37",
  failed: "#c62828",
  expired: "#c62828",
};

/** Small text badge for orders.paymentStatus — admin-only, so a plain colored
 *  label is enough; no need for the customer-facing polish of a pill/icon. */
export default function PaymentBadge({ status }: { status: string }) {
  return (
    <span style={{ color: COLOR[status] ?? "var(--text-soft)", fontWeight: 600, whiteSpace: "nowrap" }}>
      {LABEL[status] ?? status}
    </span>
  );
}
