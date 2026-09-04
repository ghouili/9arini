import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { randomUUID } from "node:crypto";
import { sql as rawSql } from "@tnajem/db";
import { warnIfSecretMissing } from "@tnajem/shared/auth-core";
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

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: loggerOptions,
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

  /* Request id on the way out, so a user-reported failure can be traced to a log
     line without asking them for anything identifying. */
  app.addHook("onSend", async (req, reply) => {
    reply.header("x-request-id", req.id);
  });

  await app.register(meRoutes);
  await app.register(authRoutes);
  await app.register(profileRoutes);

  app.get("/health", async () => {
    let dbOk = false;
    try {
      await db.execute(rawSql`select 1`);
      dbOk = true;
    } catch {
      dbOk = false;
    }
    return { ok: true, db: dbOk, version: VERSION };
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
    app.log.info({ port: PORT, host: HOST, prod: IS_PROD }, "tnajem-api listening");
  } catch (err) {
    app.log.error(err, "failed to start");
    process.exit(1);
  }
}
