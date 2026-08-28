"use client";

import { useEffect } from "react";
import "./globals.css";

/** Catches errors thrown by the root layout itself (e.g. getCurrentUser /
 *  getCartItemsForUser in layout.tsx) — error.tsx can't catch these since
 *  it renders *inside* the layout. Must define its own <html>/<body> since
 *  it fully replaces the root layout when it fires. Uses a hard navigation
 *  (not next/navigation) since the router/providers the app normally
 *  relies on may not have mounted. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error);
    window.location.replace("/maintenance");
  }, [error]);

  return (
    <html lang="en">
      <body />
    </html>
  );
}
