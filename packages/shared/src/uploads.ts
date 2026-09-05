/* MAGIC-BYTE SNIFFING — what a file ACTUALLY is.

   A multipart part's `mimetype` and `filename` are attacker-supplied strings. The
   only trustworthy signal is the first few bytes, and this is the one place that
   reads them, so the verification pipeline and the materials pipeline cannot
   drift into accepting different things.

   The list is deliberately SHORT. Every format here is one a tutor plausibly
   uploads and a browser renders inertly. SVG is absent on purpose: it is an XML
   document that can carry <script>, so "an image" that executes. */
export function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return "image/png";
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (
    buf.subarray(0, 4).toString("latin1") === "RIFF" &&
    buf.subarray(8, 12).toString("latin1") === "WEBP"
  ) return "image/webp";
  // ISO-BMFF (HEIC/HEIF): bytes 4..8 = "ftyp", brand at 8..12
  if (buf.subarray(4, 8).toString("latin1") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("latin1");
    if (["heic", "heix", "hevc", "heim", "heis", "hevm", "mif1", "msf1"].includes(brand)) {
      return "image/heic";
    }
  }
  return null;
}

/* ── YouTube ──────────────────────────────────────────────────────────────────

   STORE THE ID, NEVER THE URL. Three reasons, and the third is the one that
   matters: a stored URL is a stored redirect that some future surface renders as
   a link; an id can only ever be embedded. It also normalises the six URL shapes
   people paste, and it makes the youtube-nocookie embed the ONLY way this is
   rendered — no tracking cookie set on a page a fifteen-year-old is reading. */
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** Extract an 11-character video id from anything a tutor might paste. */
export function parseYouTubeId(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  if (YT_ID.test(raw)) return raw; // already an id

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  const ok = ["youtube.com", "m.youtube.com", "youtube-nocookie.com", "youtu.be"];
  if (!ok.includes(host)) return null;

  const candidate =
    host === "youtu.be"
      ? url.pathname.slice(1)
      : url.searchParams.get("v") ??
        url.pathname.replace(/^\/(embed|shorts|live|v)\//, "");

  const id = (candidate ?? "").split("/")[0];
  return YT_ID.test(id) ? id : null;
}

/** The privacy-preserving embed URL. The only way a video is ever rendered. */
export function youTubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
}
