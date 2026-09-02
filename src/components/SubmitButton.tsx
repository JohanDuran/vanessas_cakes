"use client";

import { useFormStatus } from "react-dom";
import DonutSpinner from "./DonutSpinner";

type Props = {
  children: React.ReactNode;
  /** shown next to the spinner while the enclosing form's action is running */
  pendingLabel?: string;
  className?: string;
};

/** A submit button for a form using a plain server-action `action={...}` (not
 *  useActionState) that shows a spinning donut + label while that action is
 *  in flight — useFormStatus only sees this while it's rendered *inside* the
 *  form it's tracking. */
export default function SubmitButton({ children, pendingLabel = "Saving…", className = "btn btn-primary" }: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-busy={pending}
      style={{ display: "inline-flex", alignItems: "center", gap: 10 }}
    >
      {pending && <DonutSpinner size={18} />}
      {pending ? pendingLabel : children}
    </button>
  );
}
