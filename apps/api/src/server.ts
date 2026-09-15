/* ./env FIRST: it loads the root .env and settles NODE_ENV (unset = production)
   before any other module in this graph reads either. */
import "./env";
import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { randomUUID } from "node:crypto";
import { STATUS_CODES } from "node:http";
import { sql as rawSql, objectStore } from "@tnajem/db";
import { warnIfSecretMissing } from "@tnajem/shared/auth-core";
import { APP_TIME_ZONE } from "@tnajem/shared";
import {
  PORT,
  HOST,
  VERSION,
  IS_PROD,
  CORS_ORIGINS,
  TRUST_PROXY,
  assertBootConfig,
} from "./env";
import { loggerOptions } from "./lib/logging";
import { db } from "./db";
import { meRoutes } from "./routes/me";
import { authRoutes } from "./routes/auth";
import { profileRoutes } from "./routes/profile";
import { tutorRoutes } from "./routes/tutors";
import { classRoutes } from "./routes/classes";
import { bookingRoutes } from "./routes/bookings";
import { miscRoutes } from "./routes/misc";
import { adminRoutes } from "./routes/admin";
import { cronRoutes } from "./routes/cron";
import { messageRoutes } from "./routes/messages";
import { materialRoutes } from "./routes/materials";
import { guardianRoutes } from "./routes/guardian";
import { moderationRoutes } from "./routes/moderation";
import { subscriptionRoutes } from "./routes/subscriptions";
import { adminAccountRoutes } from "./routes/admin-accounts";

/** logStream: tests capture every log line (test/log-pii.test.ts). */
export async function buildServer(opts: { logStream?: { write(line: string): void } } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logStream ? { ...loggerOptions, stream: opts.logStream } : loggerOptions,
    /* See env.ts. NEVER `true`: that makes X-Forwarded-For attacker-controlled and
       the per-IP OTP limiter bypassable by rotating a header. */
    trustProxy: TRUST_PROXY,
    genReqId: () => randomUUID(),
    /* Next's serverActions.bodySizeLimit is 12mb for ID-document uploads. Fastify
       defaults to 1 MiB, which would 413 every one of them. */
    bodyLimit: 13 * 1024 * 1024,
  });

  await app.register(cookie);

  /* EXACT origin allow-list, never "*" and never a reflected Origin header.
     Credentials here are cookies, and reflecting the origin is functionally "*"
     — it hands any site on the internet the ability to make authenticated
     requests as the logged-in user. */
  await app.register(cors, {
    origin: (origin, cb) => {
      // Same-origin/server-to-server requests send no Origin header.
      if (!origin) return cb(null, true);
      cb(null, CORS_ORIGINS.includes(origin));
    },
    credentials: true,
  });

  await app.register(multipart, {
    limits: {
      fileSize: 8 * 1024 * 1024, // MAX_DOC_BYTES, matching submitVerification
      files: 6,
      fields: 30,
    },
  });

  /* ONE ERROR HANDLER, and it logs a code, not an error object. Fastify's default
     logs the whole error — and a database error carries its statement parameters
     (names, phone numbers, tokens) in `params`, `query` and `cause.detail`, none of
     which the redaction paths reach. It also sent a 5xx error's MESSAGE to the
     client. Now: the code and the route in the log, a generic body for a 5xx, the
     framework's own 4xx fields (400/404/413…). */
  app.setErrorHandler((err, req, reply) => {
    const e = err as { statusCode?: number; code?: string; name?: string; cause?: { code?: string } };
    const status = e.statusCode && e.statusCode >= 400 && e.statusCode < 600 ? e.statusCode : 500;
    const where = { code: e.code ?? e.name ?? "Error", cause: e.cause?.code, route: req.routeOptions?.url };
    if (status >= 500) {
      req.log.error(where, "request failed");
      return reply.code(status).send({ statusCode: status, error: "Internal Server Error", message: "Internal Server Error" });
    }
    req.log.info(where, "request rejected");
    /* Built here rather than reply.send(err): that would hand the error to the
       framework default handler, which logs the whole object. */
    return reply
      .code(status)
      .send({ statusCode: status, code: e.code, error: STATUS_CODES[status] ?? "Error", message: (err as Error).message });
  });

  /* Request id on the way out, so a user-reported failure can be traced to a log
     line without asking them for anything identifying. */
  app.addHook("onSend", async (req, reply) => {
    reply.header("x-request-id", req.id);
  });

  await app.register(meRoutes);
  await app.register(authRoutes);
  await app.register(profileRoutes);
  await app.register(tutorRoutes);
  await app.register(classRoutes);
  await app.register(bookingRoutes);
  await app.register(miscRoutes);
  await app.register(adminRoutes);
  await app.register(messageRoutes);
  await app.register(materialRoutes);
  await app.register(guardianRoutes);
  await app.register(moderationRoutes);
  await app.register(subscriptionRoutes);
  await app.register(adminAccountRoutes);
  await app.register(cronRoutes);

  app.get("/health", async (req) => {
    let dbOk = false;
    try {
      await db.execute(rawSql`select 1`);
      dbOk = true;
    } catch (err) {
      /* LOG IT. The bare `catch {}` this replaces cost real time: the container
         reported `db:false` forever and there was no way, from inside or outside,
         to learn that the cause was `ssl: "require"` against a Postgres with no
         TLS. A health check that can say "down" but never "why" is the operational
         equivalent of a silent failure.

         The message goes to the LOG, never to the response body: /health is
         unauthenticated, and a connection error can carry the host, port and user
         from the URL. */
      req.log.error({ err }, "health: database unreachable");
      dbOk = false;
    }
    /* Still 200 when the database is down, deliberately. The body is the signal
       (Docker's HEALTHCHECK reads .db, see apps/api/Dockerfile) and a 503 with an
       empty body would tell an operator strictly less than a 200 that says
       db:false. Anything routing on this must read the JSON. */
    /* tz: the zone every class time is shown and parsed in (always Africa/Tunis)
       next to the zone this process happens to run in — they are allowed to
       differ, and an operator chasing a "wrong hour" report should see both. */
    return {
      ok: true,
      db: dbOk,
      version: VERSION,
      tz: { app: APP_TIME_ZONE, process: Intl.DateTimeFormat().resolvedOptions().timeZone },
    };
  });

  return app;
}

/* Only start when run directly, so the test suite can build an instance without
   binding a port. */
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop() ?? "");

if (isMain || process.env.API_FORCE_START === "1") {
  assertBootConfig();
  warnIfSecretMissing();

  const app = await buildServer();
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info({ port: PORT, host: HOST, prod: IS_PROD, storage: objectStore().driver }, "tnajem-api listening");
  } catch (err) {
    app.log.error(err, "failed to start");
    process.exit(1);
  }
}
