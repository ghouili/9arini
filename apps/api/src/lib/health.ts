/* The storage half of /health.
 *
 * The database probe is one `select 1`, which is honest because a connection that
 * answers is a database that works. A storage probe is not that simple: the local
 * driver's `stat` of a missing key returns null whether the directory is a healthy
 * mount or gone entirely, so a read-only probe would report "fine" for the exact
 * failure this is supposed to catch — STORAGE_DIR unmounted after a reboot, which
 * is how a persistent volume disappears in practice. Only a WRITE tells them apart.
 *
 * So it writes, and it caches. /health is reachable from the internet through the
 * web app's /api/health, and an unauthenticated endpoint that writes a file per
 * request is a disk-churn amplifier; with a 15-second floor the write rate is
 * bounded no matter how hard anything polls. Every poll inside the window gets the
 * cached answer, which is also what makes this cheap enough for a 30-second Docker
 * HEALTHCHECK and an uptime monitor at the same time.
 *
 * The key is stable per process and under the same `_`-prefixed convention
 * packages/db/bin/check.ts uses for its sentinel, so nothing that walks real
 * uploads (avatars/, materials/, verification/) ever sees it.
 */
import { objectStore } from "@tnajem/db";

const PROBE_TTL_MS = 15_000;
const PROBE_KEY = `_health/probe-${process.pid}`;
const PROBE_BYTES = new TextEncoder().encode("ok");

let cached: { at: number; ok: boolean } | null = null;
let inFlight: Promise<boolean> | null = null;

async function probe(): Promise<boolean> {
  const store = objectStore();
  try {
    await store.put(PROBE_KEY, PROBE_BYTES);
    const stat = await store.stat(PROBE_KEY);
    await store.delete(PROBE_KEY);
    return stat?.size === PROBE_BYTES.byteLength;
  } catch {
    /* The reason is deliberately dropped here rather than logged: this runs on
       every uncached /health, and a store that is down would otherwise write a
       line every 15 seconds forever. The route logs it once instead, with the
       code, the same way it logs a database failure. */
    return false;
  }
}

/** Cached for 15s, single-flight. Never throws. */
export async function storageHealthy(now = Date.now()): Promise<boolean> {
  if (cached && now - cached.at < PROBE_TTL_MS) return cached.ok;
  /* Single-flight: two concurrent health checks (Docker's and the monitor's) must
     not both write the same key — the second `delete` would race the first `stat`
     and report a false failure. */
  if (inFlight) return inFlight;
  inFlight = probe()
    .then((ok) => {
      cached = { at: Date.now(), ok };
      return ok;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Tests only: forget the cached answer. */
export function resetStorageHealth(): void {
  cached = null;
  inFlight = null;
}
