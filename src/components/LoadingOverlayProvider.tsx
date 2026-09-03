"use client";

import { useEffect, useState } from "react";
import DonutSpinner from "./DonutSpinner";

/** Every mutation in this app — Save Design, Add to Cart, Deactivate, quick
 *  field creation, all of it — goes through a Next.js Server Action, and
 *  Server Actions are dispatched as a plain POST fetch under the hood. That
 *  makes "is a POST request in flight" a reliable, single-point signal for
 *  "the app is processing something," without having to wire every
 *  individual form/button in the codebase up to a shared loading state by
 *  hand. GET requests (route navigation, Next's own Link-hover RSC
 *  prefetching) are deliberately not counted — only an actual submit should
 *  block the screen. */
export default function LoadingOverlayProvider({ children }: { children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const originalFetch = window.fetch;
    let inFlight = 0;

    const isPost = (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method) return init.method.toUpperCase() === "POST";
      if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase() === "POST";
      return false;
    };

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const tracked = isPost(input, init);
      if (tracked) {
        inFlight += 1;
        setBusy(true);
      }
      try {
        return await originalFetch(input, init);
      } finally {
        if (tracked) {
          inFlight -= 1;
          if (inFlight <= 0) {
            inFlight = 0;
            setBusy(false);
          }
        }
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <>
      {children}
      {busy && (
        <div className="loading-overlay" role="status" aria-live="polite" aria-label="Processing">
          <div className="loading-overlay__panel">
            <DonutSpinner size={48} />
            <span>Just a moment…</span>
          </div>
        </div>
      )}
    </>
  );
}
