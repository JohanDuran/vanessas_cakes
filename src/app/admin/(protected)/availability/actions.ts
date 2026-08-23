"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../../../../db";
import { pickupSettings, pickupWeeklyHours, pickupDateOverrides } from "../../../../db/schema";
import { toastMessage, toastRedirect } from "../../../../lib/adminToast";

const PATH = "/admin/availability";
const ORDERS_PATH = "/admin/orders";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export async function saveWeeklyHours(formData: FormData) {
  try {
    for (let day = 0; day < 7; day++) {
      const isOpen = formData.get(`day_${day}_open`) === "on";
      const openRaw = String(formData.get(`day_${day}_start`) ?? "");
      const closeRaw = String(formData.get(`day_${day}_end`) ?? "");

      let openTime: string | null = null;
      let closeTime: string | null = null;
      if (isOpen) {
        if (!timeSchema.safeParse(openRaw).success || !timeSchema.safeParse(closeRaw).success || openRaw >= closeRaw) {
          throw new Error("Set a valid open/close time for each open day, with open before close.");
        }
        openTime = openRaw;
        closeTime = closeRaw;
      }

      db.insert(pickupWeeklyHours)
        .values({ dayOfWeek: day, isOpen, openTime, closeTime, updatedAt: Date.now() })
        .onConflictDoUpdate({
          target: pickupWeeklyHours.dayOfWeek,
          set: { isOpen, openTime, closeTime, updatedAt: Date.now() },
        })
        .run();
    }

    revalidatePath(PATH);
  } catch (err) {
    toastRedirect(PATH, "error", toastMessage(err, "Couldn't save weekly hours."));
  }

  toastRedirect(PATH, "success", "Weekly hours saved successfully!");
}

const settingsSchema = z.object({
  leadTimeHours: z.coerce.number().int().min(0).max(24 * 30),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365),
  slotIntervalMinutes: z.coerce.number().int().min(5).max(240),
  // empty means no cap — any number of orders can share a pickup day
  maxOrdersPerDay: z.coerce.number().int().min(1).max(1000).nullable(),
});

export async function savePickupSettings(formData: FormData) {
  try {
    const raw = Object.fromEntries(formData);
    const parsed = settingsSchema.parse({
      ...raw,
      maxOrdersPerDay: raw.maxOrdersPerDay ? raw.maxOrdersPerDay : null,
    });
    const existing = db.select({ id: pickupSettings.id }).from(pickupSettings).limit(1).get();

    if (existing) {
      db.update(pickupSettings)
        .set({ ...parsed, updatedAt: Date.now() })
        .where(eq(pickupSettings.id, existing.id))
        .run();
    } else {
      db.insert(pickupSettings)
        .values({ ...parsed, updatedAt: Date.now() })
        .run();
    }

    revalidatePath(PATH);
  } catch (err) {
    toastRedirect(PATH, "error", toastMessage(err, "Couldn't save pickup settings."));
  }

  toastRedirect(PATH, "success", "Pickup settings saved successfully!");
}

const overrideSchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema,
  closed: z.coerce.number().optional(),
  openTime: z.string().optional(),
  closeTime: z.string().optional(),
  note: z.string().trim().optional(),
});

export async function addDateOverride(formData: FormData) {
  try {
    const parsed = overrideSchema.parse(Object.fromEntries(formData));
    if (parsed.endDate < parsed.startDate) {
      throw new Error("End date must be on or after the start date.");
    }

    const closed = Boolean(parsed.closed);
    let openTime: string | null = null;
    let closeTime: string | null = null;
    if (!closed) {
      const open = parsed.openTime ?? "";
      const close = parsed.closeTime ?? "";
      if (!timeSchema.safeParse(open).success || !timeSchema.safeParse(close).success || open >= close) {
        throw new Error("Set a valid open/close time, with open before close.");
      }
      openTime = open;
      closeTime = close;
    }

    db.insert(pickupDateOverrides)
      .values({
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        closed,
        openTime,
        closeTime,
        note: parsed.note || null,
      })
      .run();

    revalidatePath(PATH);
  } catch (err) {
    toastRedirect(PATH, "error", toastMessage(err, "Couldn't add this date override."));
  }

  toastRedirect(PATH, "success", "Date override added successfully!");
}

const deleteOverrideSchema = z.object({ id: z.coerce.number().int() });

export async function deleteDateOverride(formData: FormData) {
  const parsed = deleteOverrideSchema.parse(Object.fromEntries(formData));
  db.delete(pickupDateOverrides).where(eq(pickupDateOverrides.id, parsed.id)).run();
  revalidatePath("/admin/availability");
}

const dayDateSchema = z.object({ date: dateSchema });

/** Quick single-day closure from the orders calendar — lets the admin shut a
 *  day to new orders on the spot, even one with zero orders so far, without
 *  filling out the full date-override form. Equivalent to adding a one-day
 *  closed override. */
export async function closeDayForNewOrders(formData: FormData) {
  try {
    const { date } = dayDateSchema.parse(Object.fromEntries(formData));
    db.insert(pickupDateOverrides)
      .values({ startDate: date, endDate: date, closed: true, note: "Closed manually by admin" })
      .run();
    revalidatePath(ORDERS_PATH);
    revalidatePath(PATH);
  } catch (err) {
    toastRedirect(ORDERS_PATH, "error", toastMessage(err, "Couldn't close that day."));
  }

  toastRedirect(ORDERS_PATH, "success", "Day closed to new orders.");
}

/** Undoes closeDayForNewOrders — only removes an exact single-day closed
 *  override, so a multi-day vacation override stays intact and must be
 *  managed from the Date overrides table instead. */
export async function reopenDay(formData: FormData) {
  try {
    const { date } = dayDateSchema.parse(Object.fromEntries(formData));
    db.delete(pickupDateOverrides)
      .where(
        and(
          eq(pickupDateOverrides.startDate, date),
          eq(pickupDateOverrides.endDate, date),
          eq(pickupDateOverrides.closed, true)
        )
      )
      .run();
    revalidatePath(ORDERS_PATH);
    revalidatePath(PATH);
  } catch (err) {
    toastRedirect(ORDERS_PATH, "error", toastMessage(err, "Couldn't reopen that day."));
  }

  toastRedirect(ORDERS_PATH, "success", "Day reopened for new orders.");
}
