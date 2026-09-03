import { redirect } from "next/navigation";
import { ZodError } from "zod";

export type ToastVariant = "success" | "error";

/** Redirects to `path` with `?toast=...&message=...` so the site-wide
 *  ToastProvider (mounted in the root layout) can show a floating,
 *  auto-dismissing popup after the navigation lands, then strip the params
 *  from the URL. `redirect()` throws internally — call this as the last
 *  thing an action does. `extraParams` are merged into the same query
 *  string (e.g. a `next` redirect target that must survive the round trip). */
export function toastRedirect(
  path: string,
  variant: ToastVariant,
  message: string,
  extraParams?: Record<string, string>
): never {
  const qs = new URLSearchParams({ toast: variant, message, ...extraParams }).toString();
  redirect(`${path}?${qs}`);
}

/** Turns a caught error into a message safe to show in the toast. Zod's
 *  default message is a JSON blob of all issues, so pull just the first. */
export function toastMessage(err: unknown, fallback = "Something went wrong."): string {
  if (err instanceof ZodError) return err.issues[0]?.message ?? fallback;
  if (err instanceof Error) return err.message;
  return fallback;
}

/** True when a caught error is a Postgres foreign-key-violation (23503) —
 *  thrown when deleting a row still referenced, with `onDelete: "restrict"`,
 *  by another table (e.g. a field/option/design used on a real order).
 *  Lets a delete action show one friendly "still in use" message instead of
 *  the raw DB error, without having to hand-check every restrict FK itself.
 *  drizzle-orm's postgres-js driver wraps the real `postgres` error (which
 *  carries `.code`) in its own "Failed query: ..." error as `.cause`, so the
 *  code has to be checked on both the error itself and one level of cause. */
export function isForeignKeyViolation(err: unknown): boolean {
  const code = (e: unknown): unknown => (typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined);
  const cause = (e: unknown): unknown => (typeof e === "object" && e !== null ? (e as { cause?: unknown }).cause : undefined);
  return code(err) === "23503" || code(cause(err)) === "23503";
}
