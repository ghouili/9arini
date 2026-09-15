import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parsePgUrl, pgEnv, sameDatabase, summarizePgError } from "../../../packages/db/bin/_pg";

/* db:backup and db:restore hand pg_dump/pg_restore their connection through the
   child's PG* environment, parsed from DATABASE_URL by hand. A wrong parse means a
   backup of the wrong database or a confusing auth failure; a sloppy error summary
   means a password in a log. */

describe("parsePgUrl", () => {
  test("the ordinary shape", () => {
    const t = parsePgUrl("postgresql://app:secret@db.internal:6543/tnajem");
    assert.deepEqual(
      { host: t.host, port: t.port, user: t.user, password: t.password, database: t.database },
      { host: "db.internal", port: "6543", user: "app", password: "secret", database: "tnajem" },
    );
  });
  test("port defaults to 5432", () => assert.equal(parsePgUrl("postgres://u:p@h/d").port, "5432"));

  test("a raw # ? / and @ in the password do not cut it short", () => {
    const t = parsePgUrl("postgres://app:p#ss?w/rd@x@db.example:5432/tnajem?sslmode=require");
    assert.equal(t.password, "p#ss?w/rd@x");
    assert.equal(t.host, "db.example");
    assert.equal(t.database, "tnajem");
    assert.equal(t.params.sslmode, "require");
  });
  test("percent-encoded credentials are decoded, a stray % is kept", () => {
    assert.equal(parsePgUrl("postgres://app:a%40b%23c@h/d").password, "a@b#c");
    assert.equal(parsePgUrl("postgres://app:100%zz@h/d").password, "100%zz");
  });
  test("IPv6 host in brackets", () => {
    const t = parsePgUrl("postgres://u:p@[::1]:5433/d");
    assert.equal(t.host, "::1");
    assert.equal(t.port, "5433");
  });
  test("refuses what it cannot represent", () => {
    assert.throws(() => parsePgUrl("mysql://u:p@h/d"));
    assert.throws(() => parsePgUrl("postgres://u:p@h1,h2/d"));
    assert.throws(() => parsePgUrl("postgres://u:p@h"));
  });
});

describe("pgEnv", () => {
  test("carries the connection in PG* variables and drops inherited ones", () => {
    const prev = process.env.PGSERVICE;
    process.env.PGSERVICE = "somewhere-else";
    try {
      const env = pgEnv(parsePgUrl("postgres://app:pw@h:5432/d?sslmode=verify-full"));
      assert.equal(env.PGHOST, "h");
      assert.equal(env.PGPASSWORD, "pw");
      assert.equal(env.PGDATABASE, "d");
      assert.equal(env.PGSSLMODE, "verify-full");
      assert.equal(env.PGSERVICE, undefined, "an inherited PGSERVICE could redirect the dump");
    } finally {
      if (prev === undefined) delete process.env.PGSERVICE;
      else process.env.PGSERVICE = prev;
    }
  });
});

describe("sameDatabase — the guard against restoring over live data", () => {
  test("localhost spellings are the same server", () => {
    assert.ok(sameDatabase(parsePgUrl("postgres://a:b@localhost/tnajem"), parsePgUrl("postgres://c:d@127.0.0.1:5432/tnajem")));
  });
  test("a different database name is a different database", () => {
    assert.ok(!sameDatabase(parsePgUrl("postgres://a:b@localhost/tnajem"), parsePgUrl("postgres://a:b@localhost/tnajem_restore")));
  });
});

describe("summarizePgError", () => {
  test("never repeats the password, user, host or database", () => {
    const t = parsePgUrl("postgres://svc_user:Sup3rS3cret@db.prod.example:5432/tnajem_prod");
    const stderr =
      'pg_dump: error: connection to server at "db.prod.example" (10.0.0.4), port 5432 failed: ' +
      'FATAL:  password authentication failed for user "svc_user" Sup3rS3cret tnajem_prod';
    const s = summarizePgError(stderr, t);
    for (const secret of ["Sup3rS3cret", "svc_user", "db.prod.example", "tnajem_prod"]) {
      assert.ok(!s.includes(secret), `leaked ${secret}: ${s}`);
    }
    assert.match(s, /password authentication failed/);
  });
});
