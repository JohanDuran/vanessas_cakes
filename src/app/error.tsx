"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Catches any uncaught error while rendering a page and sends the visitor
 *  to the same friendly /maintenance page used for planned downtime,
 *  instead of Next.js's default "This page couldn't load" screen. By the
 *  time this fires, src/db/retry.ts has already retried any transient DB
 *  hiccup for several seconds — this is for failures that didn't clear up
 *  on their own. Doesn't cover errors thrown by the root layout itself
 *  (see global-error.tsx for that). */
export default function Error({ error }: { error: Error & { digest?: string } }) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
    router.replace("/maintenance");
  }, [error, router]);

  return null;
}
