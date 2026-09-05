/* THE UPLOAD PIPELINE — extracted so materials (Step 10) reuses it rather than
   growing a second, subtly different one.

   Every rule below was learned on the identity-document path, which is the one
   that matters most, and each is a decision rather than a formality:

     • SNIFF THE BYTES, never trust the client's Content-Type. `filename` and
       `mimetype` on a multipart part are attacker-supplied strings.
     • CHECK FOR TRUNCATION. @fastify/multipart truncates at limits.fileSize and
       does NOT throw. Miss it and an oversized upload is silently persisted as a
       CUT-OFF file — an ID scan an admin then approves believing they saw the
       whole document.
     • STORE THE SNIFFED TYPE. It is what the read path serves as Content-Type;
       echoing the client's claim there is how you get a "PNG" that the browser
       runs as HTML.
     • SANITISE THE NAME. It ends up in a Content-Disposition header, where a raw
       client name can carry CR/LF, and on disk, where it can carry "..".
     • NEVER public/. Everything lands under STORAGE_DIR, readable only through an
       endpoint that makes an access decision. */

import { sniffMime as sniff } from "@tnajem/shared";

export { sniff as sniffMime };

export type SniffedUpload = {
  fileName: string;
  bytes: Buffer;
  /** The SNIFFED type. Never the client's claim. */
  mime: string;
};

export type UploadFailure =
  | "file-too-large"
  | "bad-file-type"
  | "file-required";

/** Read one multipart file part, applying every rule above.

    Returns a discriminated result rather than throwing, because each failure is
    a domain outcome the caller reports as { ok:false, error } — the 200-with-a-
    code convention every other endpoint follows. */
export async function readUploadPart(
  part: { toBuffer(): Promise<Buffer>; file: { truncated: boolean }; filename?: string },
  opts: { maxBytes: number; allow: RegExp },
): Promise<{ ok: true; value: SniffedUpload } | { ok: false; error: UploadFailure }> {
  const bytes = await part.toBuffer();

  /* Truncation FIRST. Checking size after sniffing would still catch the byte
     count, but a truncated file can also sniff as a valid type — the magic bytes
     are at the START — so the honest order is: was this cut off at all? */
  if (part.file.truncated || bytes.length > opts.maxBytes) {
    return { ok: false, error: "file-too-large" };
  }
  if (bytes.length === 0) return { ok: false, error: "file-required" };

  const mime = sniff(bytes);
  if (!mime || !opts.allow.test(mime)) return { ok: false, error: "bad-file-type" };

  return { ok: true, value: { fileName: part.filename ?? "file", bytes, mime } };
}
