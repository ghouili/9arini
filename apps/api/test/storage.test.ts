import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localStore, objectStore, storageKey } from "@tnajem/db";

/* The object store every upload goes through (packages/db/src/storage.ts).
   These run against a throwaway directory, never STORAGE_DIR. */

let base: string;
before(async () => {
  base = await mkdtemp(join(tmpdir(), "tnajem-store-"));
});
after(async () => {
  await rm(base, { recursive: true, force: true });
});

describe("storageKey — nothing escapes the store", () => {
  test("a clean POSIX key passes through", () => {
    assert.equal(storageKey("verification/abc/id_front-1-scan.png"), "verification/abc/id_front-1-scan.png");
  });
  for (const bad of ["../etc/passwd", "a/../../b", "/abs/path", "a/./b", "", "/"]) {
    test(`refuses ${JSON.stringify(bad)}`, () => assert.throws(() => storageKey(bad)));
  }
  test("a write never takes a backslash key", () => {
    assert.throws(() => storageKey("materials\\t1\\f.pdf"));
  });
  test("a legacy backslash row is normalised on read", () => {
    assert.equal(storageKey("materials\\t1\\f.pdf", { legacy: true }), "materials/t1/f.pdf");
  });
  test("a legacy row still cannot climb out", () => {
    assert.throws(() => storageKey("..\\..\\windows\\win.ini", { legacy: true }));
  });
});

describe("localStore", () => {
  test("put → get → open → stat → delete round-trips the exact bytes", async () => {
    const store = localStore(base);
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 255]);
    await store.put("verification/t1/id_front-1-a.png", bytes);

    assert.deepEqual(await store.get("verification/t1/id_front-1-a.png"), bytes);
    const opened = await store.open("verification/t1/id_front-1-a.png");
    assert.ok(opened);
    assert.equal(opened.size, bytes.length);
    const chunks: Buffer[] = [];
    for await (const c of opened.stream) chunks.push(c as Buffer);
    assert.deepEqual(Buffer.concat(chunks), bytes);
    assert.deepEqual(await store.stat("verification/t1/id_front-1-a.png"), { size: bytes.length });

    assert.equal(await store.delete("verification/t1/id_front-1-a.png"), "deleted");
    assert.equal(await store.get("verification/t1/id_front-1-a.png"), null);
    assert.equal(await store.open("verification/t1/id_front-1-a.png"), null);
    assert.equal(await store.stat("verification/t1/id_front-1-a.png"), null);
    assert.equal(await store.delete("verification/t1/id_front-1-a.png"), "missing");
  });

  test("the on-disk layout is the key — existing files and rows keep working", async () => {
    // A file written the old way (plain fs, before the driver) is readable by key.
    await mkdir(join(base, "materials", "t2"), { recursive: true });
    await writeFile(join(base, "materials", "t2", "1-old.pdf"), "%PDF-1.4 old");
    const store = localStore(base);
    assert.equal((await store.get("materials/t2/1-old.pdf"))?.toString(), "%PDF-1.4 old");
    assert.equal((await store.get("materials\\t2\\1-old.pdf"))?.toString(), "%PDF-1.4 old");
  });

  test("a replaced object is the new bytes, and no temp file is left behind", async () => {
    const store = localStore(base);
    await store.put("avatars/t3/1-md.webp", Buffer.from("first"));
    await store.put("avatars/t3/1-md.webp", Buffer.from("second"));
    assert.equal((await store.get("avatars/t3/1-md.webp"))?.toString(), "second");
    assert.deepEqual(await readdir(join(base, "avatars", "t3")), ["1-md.webp"]);
  });

  test("concurrent puts to one key leave one whole object, never a torn one", async () => {
    const store = localStore(base);
    const a = Buffer.alloc(256 * 1024, 0x61);
    const b = Buffer.alloc(256 * 1024, 0x62);
    await Promise.all(Array.from({ length: 8 }, (_, i) => store.put("materials/t4/race.bin", i % 2 ? a : b)));
    const got = await store.get("materials/t4/race.bin");
    assert.ok(got && (got.equals(a) || got.equals(b)), "the object is exactly one of the writes");
    assert.deepEqual(await readdir(join(base, "materials", "t4")), ["race.bin"]);
  });

  test("unsafe keys throw on every operation, before touching the disk", async () => {
    const store = localStore(base);
    await assert.rejects(store.put("../outside.txt", Buffer.from("x")));
    await assert.rejects(store.get("../../etc/passwd"));
    await assert.rejects(store.open("/etc/passwd"));
    await assert.rejects(store.delete(".."));
  });

  test("a folder is not an object", async () => {
    const store = localStore(base);
    await store.put("verification/t5/doc.pdf", Buffer.from("%PDF"));
    assert.equal(await store.open("verification/t5"), null);
    assert.equal(await store.stat("verification/t5"), null);
  });

  test("pruneEmpty drops an empty folder and leaves a non-empty one", async () => {
    const store = localStore(base);
    await store.put("verification/t6/a.pdf", Buffer.from("%PDF"));
    await store.put("verification/t7/b.pdf", Buffer.from("%PDF"));
    await store.delete("verification/t6/a.pdf");
    await store.pruneEmpty("verification/t6");
    await store.pruneEmpty("verification/t7");
    await store.pruneEmpty("verification/never-existed");
    const left = await readdir(join(base, "verification"));
    assert.ok(!left.includes("t6"), "the empty folder is gone");
    assert.ok(left.includes("t7"), "a folder with a document stays");
  });
});

describe("objectStore — driver selection", () => {
  test("an unbuilt driver fails loudly instead of writing to local disk", () => {
    const prev = process.env.STORAGE_DRIVER;
    process.env.STORAGE_DRIVER = "s3";
    try {
      assert.throws(() => objectStore(), /not available in this build/);
    } finally {
      if (prev === undefined) delete process.env.STORAGE_DRIVER;
      else process.env.STORAGE_DRIVER = prev;
    }
  });
});
