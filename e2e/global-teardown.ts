export default async function globalTeardown(): Promise<void> {
  try {
    const { purgeAllRuns } = await import("./support/seed");
    const { closeDb } = await import("./support/db");
    await purgeAllRuns();
    await closeDb();
  } catch (e) {
    // Never fail a green run on cleanup; globalSetup purges leftovers anyway.
    console.warn("[e2e] teardown:", (e as Error).message);
  }
}
