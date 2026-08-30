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
