"use client";

import { useMemo, useState } from "react";
import {
  getAvailableSlots,
  toDateKey,
  fromDateKey,
  formatTimeLabel,
  WEEKDAY_LABELS,
  type WeeklyHour,
  type DateOverride,
  type PickupSettings,
} from "../../../lib/availability";

type Props = {
  availability: {
    settings: PickupSettings;
    weeklyHours: WeeklyHour[];
    overrides: DateOverride[];
    orderCountsByDate: Record<string, number>;
  };
  pickupDate: string | null;
  pickupTime: string | null;
  onChange: (date: string, time: string) => void;
};

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function leadTimeLabel(hours: number): string {
  if (hours <= 0) return "";
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `at least ${days} day${days === 1 ? "" : "s"}`;
  }
  return `at least ${hours} hour${hours === 1 ? "" : "s"}`;
}

export default function PickupStep({ availability, pickupDate, pickupTime, onChange }: Props) {
  const { settings, weeklyHours, overrides, orderCountsByDate } = availability;
  // computed once per mount — the wizard is a short-lived session, no need to re-derive "now" on every render
  const [now] = useState(() => new Date());
  const todayKey = toDateKey(now);

  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(pickupDate ? fromDateKey(pickupDate) : now)
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(pickupDate);

  const maxMonth = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() + settings.maxAdvanceDays);
    return startOfMonth(d);
  }, [now, settings.maxAdvanceDays]);

  const canGoPrevMonth = startOfMonth(now).getTime() < visibleMonth.getTime();
  const canGoNextMonth = visibleMonth.getTime() < maxMonth.getTime();

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

  const slotsForSelected = useMemo(
    () =>
      selectedDate
        ? getAvailableSlots(selectedDate, weeklyHours, overrides, settings, now, orderCountsByDate)
        : [],
    [selectedDate, weeklyHours, overrides, settings, now, orderCountsByDate]
  );

  const monthLabel = visibleMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const notice = leadTimeLabel(settings.leadTimeHours);

  return (
    <div className="wizard-step">
      <h2>Pickup Date & Time</h2>
      <p className="wizard-step__hint">
        Choose when you&apos;d like to pick up your cake.{notice && ` Orders need ${notice} of notice.`}
      </p>

      <div className="pickup-calendar">
        <div className="pickup-calendar__header">
          <button
            type="button"
            className="pickup-calendar__nav"
            disabled={!canGoPrevMonth}
            aria-label="Previous month"
            onClick={() => setVisibleMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          >
            ‹
          </button>
          <span className="pickup-calendar__month">{monthLabel}</span>
          <button
            type="button"
            className="pickup-calendar__nav"
            disabled={!canGoNextMonth}
            aria-label="Next month"
            onClick={() => setVisibleMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          >
            ›
          </button>
        </div>

        <div className="pickup-calendar__weekdays">
          {WEEKDAY_LABELS.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>

        <div className="pickup-calendar__grid">
          {cells.map((cell, i) => {
            if (!cell) return <span key={`blank-${i}`} className="pickup-calendar__cell pickup-calendar__cell--blank" />;
            const available =
              getAvailableSlots(cell.dateKey, weeklyHours, overrides, settings, now, orderCountsByDate)
                .length > 0;
            const isSelected = cell.dateKey === selectedDate;
            const isToday = cell.dateKey === todayKey;
            return (
              <button
                key={cell.dateKey}
                type="button"
                disabled={!available}
                className={`pickup-calendar__cell ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""}`}
                onClick={() => setSelectedDate(cell.dateKey)}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="pickup-slots">
          <h3 className="pickup-slots__title">
            Available times —{" "}
            {fromDateKey(selectedDate).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h3>
          {slotsForSelected.length > 0 ? (
            <div className="pickup-slots__grid">
              {slotsForSelected.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className={`pickup-slot ${pickupDate === selectedDate && pickupTime === slot ? "is-selected" : ""}`}
                  onClick={() => onChange(selectedDate, slot)}
                >
                  {formatTimeLabel(slot)}
                </button>
              ))}
            </div>
          ) : (
            <p className="pickup-slots__empty">No pickup times left on this date — try another day.</p>
          )}
        </div>
      )}
    </div>
  );
}
