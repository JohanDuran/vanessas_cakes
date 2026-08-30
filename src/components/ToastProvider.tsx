"use client";

import { createContext, Suspense, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type ToastVariant = "success" | "error";
type Toast = { id: number; variant: ToastVariant; message: string };

const DISMISS_MS = 4000;

type ToastContextValue = {
  push: (variant: ToastVariant, message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** Lets any client component show a floating, auto-dismissing message —
 *  the direct-call counterpart to lib/toast.ts's toastRedirect (which does
 *  the same thing across a server-action redirect). */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

function ToastList({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-host" role="region" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} role="status" className={`toast toast--${t.variant}`}>
          <span className="toast__message">{t.message}</span>
          <button type="button" onClick={() => onDismiss(t.id)} aria-label="Dismiss" className="toast__dismiss">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

/** Picks up `?toast=success|error&message=...` left by toastRedirect,
 *  surfaces it as a floating toast, then strips those params from the URL
 *  so a refresh doesn't re-show it. */
function QueryParamToastBridge({ push }: { push: (variant: ToastVariant, message: string) => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const variant = searchParams.get("toast");
    const message = searchParams.get("message");
    if (variant !== "success" && variant !== "error") return;
    if (!message) return;

    push(variant, message);

    const params = new URLSearchParams(searchParams);
    params.delete("toast");
    params.delete("message");
    const rest = params.toString();
    router.replace(rest ? `${pathname}?${rest}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return null;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, variant, message }]);
      setTimeout(() => dismiss(id), DISMISS_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ push }}>
      <Suspense fallback={null}>
        <QueryParamToastBridge push={push} />
      </Suspense>
      {children}
      <ToastList toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
