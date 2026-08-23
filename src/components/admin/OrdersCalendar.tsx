"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { fromDateKey, toDateKey, formatTimeLabel, WEEKDAY_LABELS } from "../../lib/availability";
import { formatCents } from "../../lib/pricing";

export type CalendarOrder = {
  id: number;
  customerName: string;
  /** e.g. "Midnight Choco Drip" or "Midnight Choco Drip +1 more" for a
   *  multi-cake order — pre-joined by the caller from that order's items. */
  itemSummary: string;
  pickupTime: string | null;
  totalPriceCents: number;
  status: string;
};

type DateOverride = { startDate: string; endDate: string; closed: boolean };

type Props = {
  ordersByDate: Record<string, CalendarOrder[]>;
  maxOrdersPerDay: number | null;
  overrides: DateOverride[];
  closeDayForNewOrders: (formData: FormData) => Promise<void>;
  reopenDay: (formData: FormData) => Promise<void>;
};

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** The single-day closed override (startDate===endDate===dateKey) that
 *  closeDayForNewOrders creates, if one exists for this date — the only kind
 *  reopenDay can undo. */
function findManualClosure(dateKey: string, overrides: DateOverride[]): DateOverride | undefined {
  return overrides.find((o) => o.startDate === dateKey && o.endDate === dateKey && o.closed);
}

/** Any override (single-day or a broader range) that closes this date. */
function findClosingOverride(dateKey: string, overrides: DateOverride[]): DateOverride | undefined {
  return overrides.find((o) => o.startDate <= dateKey && dateKey <= o.endDate && o.closed);
}

export default function OrdersCalendar({
  ordersByDate,
  maxOrdersPerDay,
  overrides,
  closeDayForNewOrders,
  reopenDay,
}: Props) {
  const [now] = useState(() => new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(now));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const todayKey = toDateKey(now);

  const cells = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list: Array<{ dateKey: string; day: number } | null> = [];
    for (let i = 0; i < firstWeekday; i++) list.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      list.push({ dateKey: toDateKey(new Date(year, month, day)), day });
    }
    return list;
  }, [visibleMonth]);

  const monthLabel = visibleMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const selectedOrders = selectedDate ? (ordersByDate[selectedDate] ?? []) : [];

  return (
    <div className="admin-card">
      <h3 style={{ marginBottom: 6 }}>Pickup Calendar</h3>
      <p style={{ color: "var(--text-soft)", fontSize: "0.88rem", marginBottom: 16 }}>
        Days with scheduled pickups are marked with the number of orders. Click a day to see the details.
      </p>

      <div className="orders-calendar">
        <div className="orders-calendar__header">
          <button
            type="button"
            className="orders-calendar__nav"
            aria-label="Previous month"
            onClick={() => setVisibleMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          >
            ‹
          </button>
          <span className="orders-calendar__month">{monthLabel}</span>
          <button
            type="button"
            className="orders-calendar__nav"
            aria-label="Next month"
            onClick={() => setVisibleMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          >
            ›
          </button>
        </div>

        <div className="orders-calendar__weekdays">
          {WEEKDAY_LABELS.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>

        <div className="orders-calendar__grid">
          {cells.map((cell, i) => {
            if (!cell) {
              return <span key={`blank-${i}`} className="orders-calendar__cell orders-calendar__cell--blank" />;
            }
            const dayOrders = ordersByDate[cell.dateKey] ?? [];
            const hasNew = dayOrders.some((o) => o.status === "new");
            const isToday = cell.dateKey === todayKey;
            const isFull = !!maxOrdersPerDay && dayOrders.length >= maxOrdersPerDay;
            const isClosed = isFull || !!findClosingOverride(cell.dateKey, overrides);
            return (
              <button
                key={cell.dateKey}
                type="button"
                className={`orders-calendar__cell ${isToday ? "is-today" : ""} ${
                  dayOrders.length > 0 ? "has-orders" : ""
                } ${hasNew ? "has-new" : ""} ${isClosed ? "is-closed" : ""}`}
                onClick={() => setSelectedDate(cell.dateKey)}
              >
                <span className="orders-calendar__day">{cell.day}</span>
                {dayOrders.length > 0 && <span className="orders-calendar__badge">{dayOrders.length}</span>}
              </button>
            );
          })}
        </div>

        <div className="orders-calendar__legend">
          <span className="orders-calendar__legend-item">
            <span className="orders-calendar__legend-swatch orders-calendar__legend-swatch--orders" /> Has orders
          </span>
          <span className="orders-calendar__legend-item">
            <span className="orders-calendar__legend-swatch orders-calendar__legend-swatch--new" /> New orders
          </span>
          <span className="orders-calendar__legend-item">
            <span className="orders-calendar__legend-swatch orders-calendar__legend-swatch--closed" /> Closed to new orders
          </span>
        </div>
      </div>

      {selectedDate && (
        <div className="admin-modal-overlay" onClick={() => setSelectedDate(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal__header">
              <div>
                <span className="section-eyebrow">Pickups</span>
                <h2 style={{ marginTop: 6 }}>
                  {fromDateKey(selectedDate).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </h2>
              </div>
              <button
                type="button"
                className="admin-modal__close"
                onClick={() => setSelectedDate(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {selectedOrders.length === 0 ? (
              <p style={{ color: "var(--text-soft)" }}>No orders scheduled for pickup this day.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {selectedOrders.map((o) => (
                  <Link key={o.id} href={`/admin/orders/${o.id}`} className="orders-calendar__order-row">
                    <div>
                      <strong>{o.customerName}</strong>
                      <div style={{ fontSize: "0.82rem", color: "var(--text-soft)" }}>
                        {o.itemSummary}
                        {o.pickupTime && ` · ${formatTimeLabel(o.pickupTime)}`}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div>{formatCents(o.totalPriceCents)}</div>
                      <div style={{ fontSize: "0.78rem", textTransform: "capitalize", color: "var(--text-soft)" }}>
                        {o.status}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {(() => {
              const isFull = !!maxOrdersPerDay && selectedOrders.length >= maxOrdersPerDay;
              const manualClosure = findManualClosure(selectedDate, overrides);
              const closingOverride = findClosingOverride(selectedDate, overrides);

              if (isFull) {
                return (
                  <p style={{ fontSize: "0.85rem", color: "var(--text-soft)" }}>
                    This day is full ({selectedOrders.length}/{maxOrdersPerDay} orders) — closed to new
                    orders automatically.
                  </p>
                );
              }

              if (manualClosure) {
                return (
                  <form action={reopenDay}>
                    <input type="hidden" name="date" value={selectedDate} />
                    <button type="submit" className="btn btn-primary">
                      Reopen this day for new orders
                    </button>
                  </form>
                );
              }

              if (closingOverride) {
                return (
                  <p style={{ fontSize: "0.85rem", color: "var(--text-soft)" }}>
                    Closed by a multi-day override
                    {closingOverride.startDate !== closingOverride.endDate &&
                      ` (${closingOverride.startDate} – ${closingOverride.endDate})`}
                    . Manage it from the Availability page.
                  </p>
                );
              }

              return (
                <form action={closeDayForNewOrders}>
                  <input type="hidden" name="date" value={selectedDate} />
                  <button type="submit" className="admin-btn-sm admin-btn-sm--danger">
                    Close this day for new orders
                  </button>
                </form>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
