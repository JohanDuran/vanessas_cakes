"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Toast = { id: number; variant: "success" | "error"; message: string };

const DISMISS_MS = 3000;

function ToastHostInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    const variant = searchParams.get("toast");
    const message = searchParams.get("message");
    if (variant !== "success" && variant !== "error") return;
    if (!message) return;

    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, variant, message }]);

    const params = new URLSearchParams(searchParams);
    params.delete("toast");
    params.delete("message");
    const rest = params.toString();
    router.replace(rest ? `${pathname}?${rest}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, DISMISS_MS)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 360,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          style={{
            padding: "12px 16px",
            borderRadius: "var(--radius-sm, 8px)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
            color: "#fff",
            background: t.variant === "success" ? "#16a34a" : "#c0392b",
            fontSize: "0.9rem",
            lineHeight: 1.4,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            type="button"
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            aria-label="Dismiss"
            style={{
              background: "transparent",
              border: "none",
              color: "#fff",
              opacity: 0.8,
              cursor: "pointer",
              fontSize: "1rem",
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export default function ToastHost() {
  return (
    <Suspense fallback={null}>
      <ToastHostInner />
    </Suspense>
  );
}
