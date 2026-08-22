"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../../../../db";
import { pickupSettings, pickupWeeklyHours, pickupDateOverrides } from "../../../../db/schema";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export async function saveWeeklyHours(formData: FormData) {
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

  revalidatePath("/admin/availability");
}

const settingsSchema = z.object({
  leadTimeHours: z.coerce.number().int().min(0).max(24 * 30),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365),
  slotIntervalMinutes: z.coerce.number().int().min(5).max(240),
});

export async function savePickupSettings(formData: FormData) {
  const parsed = settingsSchema.parse(Object.fromEntries(formData));
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

  revalidatePath("/admin/availability");
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

  revalidatePath("/admin/availability");
}

const deleteOverrideSchema = z.object({ id: z.coerce.number().int() });

export async function deleteDateOverride(formData: FormData) {
  const parsed = deleteOverrideSchema.parse(Object.fromEntries(formData));
  db.delete(pickupDateOverrides).where(eq(pickupDateOverrides.id, parsed.id)).run();
  revalidatePath("/admin/availability");
}
