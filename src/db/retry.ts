// Codes that mean "the DB or its connection pooler is momentarily out of
// resources," not a query bug — e.g. Supabase's session-mode pooler
// rejecting new connections once its own pool_size cap is hit
// (EMAXCONNSESSION surfaces as XX000). Safe to retry only for reads.
const RETRYABLE_CODES = new Set([
  "XX000", // Supavisor's generic error code, incl. EMAXCONNSESSION
  "53300", // too_many_connections
  "57P03", // cannot_connect_now
  "08006", "08003", "08001", "08004", // connection failure family
]);

function isRetryable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  if (code && RETRYABLE_CODES.has(code)) return true;
  return isRetryable((err as { cause?: unknown }).cause);
}

/** Retries a read for up to `budgetMs` when the failure looks like transient
 *  connection/pool exhaustion, instead of failing the request (and the page
 *  along with it) the instant the pool is momentarily full. Only wrap
 *  read-only queries with this — never a write or a transaction, where a
 *  blind retry could re-run a side effect that partially succeeded. */
export async function withDbRetry<T>(fn: () => Promise<T>, budgetMs = 6000): Promise<T> {
  const start = Date.now();
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const elapsed = Date.now() - start;
      if (!isRetryable(err) || elapsed >= budgetMs) throw err;
      const backoff = Math.min(1000, 100 * 2 ** attempt) + Math.random() * 100;
      await new Promise((r) => setTimeout(r, Math.min(backoff, budgetMs - elapsed)));
    }
  }
}
