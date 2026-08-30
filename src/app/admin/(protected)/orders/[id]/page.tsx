import { notFound } from "next/navigation";
import { db } from "../../../../../db";
import { orders } from "../../../../../db/schema";
import { loadOrderWithItems, type OrderItemDetailDTO } from "../../../../../db/queries";
import { eq } from "drizzle-orm";
import { baseFieldRank, CONTACT_PREFERENCE_LABELS, isContactPreference } from "../../../../../lib/fields";
import { formatCents } from "../../../../../lib/pricing";
import { fromDateKey, formatTimeLabel } from "../../../../../lib/availability";
import { setOrderStatus, markBalanceCollected, saveQuotePrice, setQuoteStatus } from "../actions";
import PaymentBadge from "../../../../../components/admin/PaymentBadge";
import QuoteStatusBadge from "../../../../../components/admin/QuoteStatusBadge";

export const dynamic = "force-dynamic";

function centsToDollarsStr(cents: number) {
  return (cents / 100).toFixed(2);
}

/** Groups one item's flat selection rows by field (so a multi-select field's
 *  several rows show as one line) in canonical base-field order. */
function groupSelections(selections: OrderItemDetailDTO["selections"]) {
  const rowsByField = new Map<number, OrderItemDetailDTO["selections"]>();
  for (const s of selections) {
    const list = rowsByField.get(s.fieldId) ?? [];
    list.push(s);
    rowsByField.set(s.fieldId, list);
  }
  const orderedFieldIds = Array.from(rowsByField.keys()).sort(
    (a, b) => baseFieldRank(rowsByField.get(a)![0].fieldSlug) - baseFieldRank(rowsByField.get(b)![0].fieldSlug)
  );
  return orderedFieldIds.map((fieldId) => {
    const rows = rowsByField.get(fieldId)!;
    return {
      fieldId,
      fieldName: rows[0].fieldName,
      label: rows.map((r) => r.labelSnapshot).join(", "),
      price: rows.reduce((sum, r) => sum + r.priceCentsSnapshot, 0),
    };
  });
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();

  const order = await db.select().from(orders).where(eq(orders.id, orderId)).then((r) => r[0]);
  if (!order) notFound();

  if (order.status === "new") {
    await db.update(orders).set({ status: "viewed" }).where(eq(orders.id, orderId));
    order.status = "viewed";
  }

  const result = await loadOrderWithItems(orderId);
  if (!result) notFound();
  const { items } = result;

  return (
    <>
      <h1>Order #{order.id}</h1>
      <p className="admin-main__subtitle">
        Submitted {new Date(order.createdAt).toLocaleString()} · Status: {order.status} · Payment:{" "}
        <PaymentBadge status={order.paymentStatus} />
      </p>
      {order.paymentStatus === "pending" && (
        <p className="admin-main__subtitle" style={{ color: "#b8860b" }}>
          This order hasn&apos;t been paid yet — the customer may still be completing (or may have abandoned)
          Stripe Checkout. Don&apos;t start on it until payment shows as Paid.
        </p>
      )}
      {order.stripePaymentIntentId && (
        <p className="admin-main__subtitle">Stripe payment: <code>{order.stripePaymentIntentId}</code></p>
      )}

      {order.paymentStatus !== "not_required" && (
        <div className="admin-card">
          <h3 style={{ marginBottom: 10 }}>Payment</h3>
          <p>Plan: {order.paymentPlan === "deposit" ? "50% deposit" : "Full payment"}</p>
          <p>Charged: {formatCents(order.amountDueCents)}</p>
          {order.paymentPlan === "deposit" && (
            <>
              <p>Balance due: {formatCents(order.totalPriceCents - order.amountDueCents)}</p>
              <p>
                {order.balanceCollectedAt
                  ? `Balance collected ${new Date(order.balanceCollectedAt).toLocaleString()}`
                  : "Balance not yet collected"}
              </p>
              {order.paymentStatus === "paid" && !order.balanceCollectedAt && (
                <form action={markBalanceCollected}>
                  <input type="hidden" name="id" value={order.id} />
                  <button type="submit" className="admin-btn-sm admin-btn-sm--ghost">
                    Mark balance as collected
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      )}

      <div className="admin-card">
        <h3 style={{ marginBottom: 10 }}>Customer</h3>
        <p>{order.customerName}</p>
        <p>{order.customerEmail}</p>
        {order.customerPhone && <p>{order.customerPhone}</p>}
        {order.contactPreference && isContactPreference(order.contactPreference) && (
          <p>Prefers: {CONTACT_PREFERENCE_LABELS[order.contactPreference]}</p>
        )}
      </div>

      <div className="admin-card">
        <h3 style={{ marginBottom: 10 }}>Pickup</h3>
        <p>
          {order.pickupDate && order.pickupTime
            ? `${fromDateKey(order.pickupDate).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })} at ${formatTimeLabel(order.pickupTime)}`
            : "Not scheduled"}
        </p>
      </div>

      {items.map((item, index) => {
        const isCustom = item.designKind !== "catalog";
        const groupedSelections = groupSelections(item.selections);
        return (
          <div key={item.id}>
            {item.referenceImagePaths.length > 0 && (
              <div className="admin-card">
                <h3 style={{ marginBottom: 10 }}>Reference Images {items.length > 1 ? `— Cake ${index + 1}` : ""}</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {item.referenceImagePaths.map((path) => (
                    <a key={path} href={path} target="_blank" rel="noopener noreferrer">
                      <img
                        src={path}
                        alt="Customer reference"
                        style={{ width: 110, height: 110, objectFit: "cover", borderRadius: 8 }}
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="admin-card">
              <h3 style={{ marginBottom: 10 }}>
                {items.length > 1 ? `Cake ${index + 1} — ` : ""}
                {isCustom ? "Custom Cake Quote" : (item.designName ?? "Unknown design")}
              </h3>
              {groupedSelections.length === 0 && isCustom ? (
                <p>No details provided — the customer left every field blank.</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Selection</th>
                      {!isCustom && <th>Price</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {groupedSelections.map((row) => (
                      <tr key={row.fieldId}>
                        <td>{row.fieldName}</td>
                        <td>{row.label}</td>
                        {!isCustom && <td>{formatCents(row.price)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {!isCustom && (
                <div style={{ marginTop: 14, fontWeight: 700, fontFamily: "var(--font-heading)" }}>
                  Total: {formatCents(item.priceCents)}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {order.quoteStatus != null && (
        <div className="admin-card">
          <h3 style={{ marginBottom: 10 }}>
            Quote Pricing — <QuoteStatusBadge status={order.quoteStatus} />
          </h3>

          {order.quoteStatus === "accepted" ? (
            <>
              {order.quoteNotes && <p style={{ whiteSpace: "pre-wrap" }}>{order.quoteNotes}</p>}
              <p style={{ fontWeight: 700 }}>{formatCents(order.totalPriceCents)}</p>
            </>
          ) : (
            <>
              <form action={saveQuotePrice} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input type="hidden" name="id" value={order.id} />
                <div className="admin-field">
                  <label htmlFor="quoteNotes">Notes</label>
                  <textarea
                    id="quoteNotes"
                    name="notes"
                    rows={3}
                    defaultValue={order.quoteNotes ?? ""}
                    placeholder="How this price was worked out — tiers, flavors, rush fee, etc."
                  />
                </div>
                <div className="admin-field">
                  <label htmlFor="quotePriceDollars">Price ($)</label>
                  <input
                    id="quotePriceDollars"
                    name="priceDollars"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={order.quoteStatus === "new" ? "" : centsToDollarsStr(order.totalPriceCents)}
                    style={{ minWidth: 110 }}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
                  {order.quoteStatus === "new" ? "Save Quote Price" : "Recalculate"}
                </button>
              </form>

              {(order.quoteStatus === "calculated" || order.quoteStatus === "awaiting_confirmation") && (
                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  {order.quoteStatus === "calculated" && (
                    <form action={setQuoteStatus}>
                      <input type="hidden" name="id" value={order.id} />
                      <input type="hidden" name="status" value="awaiting_confirmation" />
                      <button type="submit" className="admin-btn-sm admin-btn-sm--ghost">
                        Mark Awaiting Confirmation
                      </button>
                    </form>
                  )}
                  <form action={setQuoteStatus}>
                    <input type="hidden" name="id" value={order.id} />
                    <input type="hidden" name="status" value="accepted" />
                    <button type="submit" className="admin-btn-sm">
                      Accept
                    </button>
                  </form>
                  <form action={setQuoteStatus}>
                    <input type="hidden" name="id" value={order.id} />
                    <input type="hidden" name="status" value="rejected" />
                    <button type="submit" className="admin-btn-sm admin-btn-sm--danger">
                      Reject
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="admin-card">
        <h3 style={{ marginBottom: 10, fontFamily: "var(--font-heading)" }}>Order Total</h3>
        <div style={{ fontWeight: 700 }}>
          {order.quoteStatus === "new" ? "Not yet quoted" : formatCents(order.totalPriceCents)}
        </div>
      </div>

      {order.comments && (
        <div className="admin-card">
          <h3 style={{ marginBottom: 10 }}>Comments</h3>
          <p>{order.comments}</p>
        </div>
      )}

      <div className="admin-card" style={{ display: "flex", gap: 10 }}>
        {order.status !== "archived" ? (
          <form action={setOrderStatus}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="status" value="archived" />
            <button type="submit" className="admin-btn-sm admin-btn-sm--danger">
              Archive
            </button>
          </form>
        ) : (
          <form action={setOrderStatus}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="status" value="viewed" />
            <button type="submit" className="admin-btn-sm admin-btn-sm--ghost">
              Unarchive
            </button>
          </form>
        )}
      </div>
    </>
  );
}
