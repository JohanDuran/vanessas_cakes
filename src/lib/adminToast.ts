import { redirect } from "next/navigation";
import { ZodError } from "zod";

export type ToastVariant = "success" | "error";

/** Redirects to `path` with `?toast=...&message=...` so the admin layout's
 *  ToastHost can show a corner popup after the navigation lands, then strip
 *  the params from the URL. `redirect()` throws internally — call this as
 *  the last thing an action does. */
export function toastRedirect(path: string, variant: ToastVariant, message: string): never {
  const qs = new URLSearchParams({ toast: variant, message }).toString();
  redirect(`${path}?${qs}`);
}

/** Turns a caught error into a message safe to show in the toast. Zod's
 *  default message is a JSON blob of all issues, so pull just the first. */
export function toastMessage(err: unknown, fallback = "Something went wrong."): string {
  if (err instanceof ZodError) return err.issues[0]?.message ?? fallback;
  if (err instanceof Error) return err.message;
  return fallback;
}
