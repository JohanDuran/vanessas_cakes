import { db } from "../../../../db";
import { pickupDateOverrides } from "../../../../db/schema";
import { loadPickupAvailability } from "../../../../db/queries";
import { WEEKDAY_LABELS_FULL } from "../../../../lib/availability";
import { saveWeeklyHours, savePickupSettings, addDateOverride, deleteDateOverride } from "./actions";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const [{ settings, weeklyHours }, allOverrides] = await Promise.all([
    loadPickupAvailability(),
    db.select().from(pickupDateOverrides).orderBy(pickupDateOverrides.startDate).then((r) => r),
  ]);

  return (
    <>
      <h1>Pickup Availability</h1>
      <p className="admin-main__subtitle">
        Configure when customers can schedule cake pickup — weekly hours, booking rules, and one-off
        closures or custom hours.
      </p>

      <div className="admin-card">
        <h3 style={{ marginBottom: 6 }}>Weekly hours</h3>
        <p style={{ color: "var(--text-soft)", fontSize: "0.88rem", marginBottom: 16 }}>
          The default pickup window for each day of the week. Uncheck a day to close it entirely.
        </p>
        <form action={saveWeeklyHours}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Open</th>
                <th>From</th>
                <th>To</th>
              </tr>
            </thead>
            <tbody>
              {weeklyHours.map((day) => (
                <tr key={day.dayOfWeek}>
                  <td>{WEEKDAY_LABELS_FULL[day.dayOfWeek]}</td>
                  <td>
                    <input
                      type="checkbox"
                      name={`day_${day.dayOfWeek}_open`}
                      defaultChecked={day.isOpen}
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      name={`day_${day.dayOfWeek}_start`}
                      defaultValue={day.openTime ?? "09:00"}
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      name={`day_${day.dayOfWeek}_end`}
                      defaultValue={day.closeTime ?? "17:00"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 16 }}>
            Save Weekly Hours
          </button>
        </form>
      </div>

      <div className="admin-card">
        <h3 style={{ marginBottom: 6 }}>Booking rules</h3>
        <p style={{ color: "var(--text-soft)", fontSize: "0.88rem", marginBottom: 16 }}>
          How much notice you need, how far out customers can book, and how the pickup day is sliced
          into selectable time slots.
        </p>
        <form action={savePickupSettings} className="admin-form-row">
          <div className="admin-field">
            <label>Minimum notice (hours)</label>
            <input
              type="number"
              name="leadTimeHours"
              min={0}
              max={720}
              defaultValue={settings.leadTimeHours}
              required
            />
          </div>
          <div className="admin-field">
            <label>Max days in advance</label>
            <input
              type="number"
              name="maxAdvanceDays"
              min={1}
              max={365}
              defaultValue={settings.maxAdvanceDays}
              required
            />
          </div>
          <div className="admin-field">
            <label>Slot length (minutes)</label>
            <input
              type="number"
              name="slotIntervalMinutes"
              min={5}
              max={240}
              step={5}
              defaultValue={settings.slotIntervalMinutes}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: "10px 22px" }}>
            Save Rules
          </button>
        </form>
      </div>

      <div className="admin-card">
        <h3 style={{ marginBottom: 6 }}>Date overrides</h3>
        <p style={{ color: "var(--text-soft)", fontSize: "0.88rem", marginBottom: 16 }}>
          Close specific dates (holidays, vacation) or give a date range custom hours — this always
          wins over the weekly default.
        </p>
        <form action={addDateOverride} className="admin-form-row" style={{ marginBottom: 20 }}>
          <div className="admin-field">
            <label>From</label>
            <input type="date" name="startDate" required />
          </div>
          <div className="admin-field">
            <label>To</label>
            <input type="date" name="endDate" required />
          </div>
          <div className="admin-field">
            <label>Closed all day</label>
            <input type="checkbox" name="closed" defaultChecked />
          </div>
          <div className="admin-field">
            <label>Custom open</label>
            <input type="time" name="openTime" />
          </div>
          <div className="admin-field">
            <label>Custom close</label>
            <input type="time" name="closeTime" />
          </div>
          <div className="admin-field" style={{ flex: 1, minWidth: 160 }}>
            <label>Note (optional)</label>
            <input type="text" name="note" placeholder="e.g. Christmas break" />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: "10px 22px" }}>
            Add Override
          </button>
        </form>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Dates</th>
              <th>Hours</th>
              <th>Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {allOverrides.map((o) => (
              <tr key={o.id}>
                <td>{o.startDate === o.endDate ? o.startDate : `${o.startDate} – ${o.endDate}`}</td>
                <td>{o.closed ? "Closed" : `${o.openTime} – ${o.closeTime}`}</td>
                <td>{o.note ?? "—"}</td>
                <td>
                  <form action={deleteDateOverride}>
                    <input type="hidden" name="id" value={o.id} />
                    <button type="submit" className="admin-btn-sm admin-btn-sm--danger">
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {allOverrides.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: "var(--text-soft)" }}>
                  No overrides yet — every date follows the weekly hours above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
