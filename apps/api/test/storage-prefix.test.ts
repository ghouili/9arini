import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localStore, s3Store, type S3Config } from "@tnajem/db";

/* phase-a lane L4 (A11) — ObjectStore.deletePrefix, on BOTH drivers.

   Erasure deletes everything under avatars/<tutorId>/, including photos no row
   points at any more. The local driver runs against a throwaway directory; the S3
   driver runs against a STUBBED client (no bucket, no Docker, no network), which
   proves the calls it makes: list the folder page by page, delete each object,
   never anything outside the folder. */

let base: string;
before(async () => {
  base = await mkdtemp(join(tmpdir(), "tnajem-prefix-"));
});
after(async () => {
  await rm(base, { recursive: true, force: true });
});

describe("localStore.deletePrefix", () => {
  test("deletes every object under the folder, nested too, and nothing beside it", async () => {
    const store = localStore(base);
    const keep = "avatars/t1x/100-md.webp"; // a sibling whose name STARTS with the folder's
    for (const k of ["avatars/t1/100-sm.webp", "avatars/t1/100-md.webp", "avatars/t1/200-lg.webp", "avatars/t1/old/1-sm.webp", keep]) {
      await store.put(k, Buffer.from(k));
    }
    assert.deepEqual(await store.deletePrefix("avatars/t1"), { deleted: 4 });
    assert.equal(await store.get("avatars/t1/100-md.webp"), null);
    assert.ok(await store.get(keep), "a sibling folder is untouched");
    assert.deepEqual(await readdir(join(base, "avatars")), ["t1x"], "the emptied folder itself is gone");
  });

  test("a missing folder is zero, not an error", async () => {
    assert.deepEqual(await localStore(base).deletePrefix("avatars/nobody"), { deleted: 0 });
  });

  test("a whole namespace, or a key that climbs out, is refused", async () => {
    const store = localStore(base);
    await assert.rejects(store.deletePrefix("avatars"));
    await assert.rejects(store.deletePrefix("avatars/../verification"));
  });
});

describe("s3Store.deletePrefix (stubbed client)", () => {
  const cfg: S3Config = {
    bucket: "tnajem-test", region: "us-east-1", accessKeyId: "x", secretAccessKey: "y",
    forcePathStyle: true, prefix: "prod",
  };

  function stub(pages: { keys: string[]; next?: string }[], opts: { listFails?: number } = {}) {
    const calls: { name: string; input: Record<string, unknown> }[] = [];
    let page = 0;
    const client = {
      async send(command: unknown) {
        const c = command as { constructor: { name: string }; input: Record<string, unknown> };
        calls.push({ name: c.constructor.name, input: c.input });
        if (c.constructor.name === "ListObjectsV2Command") {
          if (opts.listFails) throw Object.assign(new Error("denied"), { name: "AccessDenied", $metadata: { httpStatusCode: opts.listFails } });
          const p = pages[page++] ?? { keys: [] };
          return { Contents: p.keys.map((Key) => ({ Key })), IsTruncated: Boolean(p.next), NextContinuationToken: p.next };
        }
        return {};
      },
    };
    return { client, calls };
  }

  test("lists the folder under S3_PREFIX page by page and deletes each object in it", async () => {
    const { client, calls } = stub([
      { keys: ["prod/avatars/t1/100-sm.webp", "prod/avatars/t1/100-md.webp"], next: "tok-2" },
      { keys: ["prod/avatars/t1/200-lg.webp", "prod/avatars/t1x/should-not-happen.webp"] },
    ]);
    const res = await s3Store(cfg, { client }).deletePrefix("avatars/t1");
    assert.deepEqual(res, { deleted: 3 });

    const lists = calls.filter((c) => c.name === "ListObjectsV2Command");
    assert.equal(lists.length, 2, "two pages");
    assert.equal(lists[0].input.Prefix, "prod/avatars/t1/", "folder-bounded: the trailing slash matters");
    assert.equal(lists[1].input.ContinuationToken, "tok-2");
    assert.deepEqual(
      calls.filter((c) => c.name === "DeleteObjectCommand").map((c) => c.input.Key),
      ["prod/avatars/t1/100-sm.webp", "prod/avatars/t1/100-md.webp", "prod/avatars/t1/200-lg.webp"],
      "every object in the folder, and nothing outside it",
    );
    assert.equal(calls[0].name, "HeadBucketCommand", "the bucket is proven before anything is listed");
  });

  test("a refused listing throws — it is never read as 'nothing there'", async () => {
    const { client, calls } = stub([], { listFails: 403 });
    await assert.rejects(s3Store(cfg, { client }).deletePrefix("avatars/t1"));
    assert.equal(calls.filter((c) => c.name === "DeleteObjectCommand").length, 0);
  });

  test("a whole namespace is refused before any call", async () => {
    const { client, calls } = stub([]);
    await assert.rejects(s3Store(cfg, { client }).deletePrefix("avatars"));
    assert.equal(calls.length, 0);
  });
});
