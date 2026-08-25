import { formatCents } from "../../lib/pricing";

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

type Props = {
  status: string;
  // when provided (and paymentPlan is "deposit"), shows a subtext line with
  // the outstanding balance and whether it's been collected — see
  // orders.balanceCollectedAt in src/db/schema.ts
  paymentPlan?: string;
  balanceCents?: number;
  balanceCollectedAt?: number | null;
};

/** Small text badge for orders.paymentStatus — admin-only, so a plain colored
 *  label is enough; no need for the customer-facing polish of a pill/icon. */
export default function PaymentBadge({ status, paymentPlan, balanceCents, balanceCollectedAt }: Props) {
  const showBalance = paymentPlan === "deposit" && status === "paid" && balanceCents != null && balanceCents > 0;

  return (
    <span style={{ whiteSpace: "nowrap" }}>
      <span style={{ color: COLOR[status] ?? "var(--text-soft)", fontWeight: 600 }}>{LABEL[status] ?? status}</span>
      {showBalance && (
        <div style={{ fontSize: "0.8rem", color: "var(--text-soft)" }}>
          {balanceCollectedAt
            ? "Balance collected"
            : `50% deposit · ${formatCents(balanceCents)} due at pickup`}
        </div>
      )}
    </span>
  );
}
