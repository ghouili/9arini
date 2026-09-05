import sharp from "sharp";

/* ══════════════════════════════════════════════════════════════════════════════
   BOUND LIBVIPS BEFORE ANYTHING ELSE. This is not tuning; it is what stops the
   process dying.
   ══════════════════════════════════════════════════════════════════════════════
   Found by the Docker E2E run, which failed with `ENOMEM: not enough memory,
   read` — and failed on a DIFFERENT test each time, which is what a
   memory-pressure problem looks like from the outside and why it reads as a
   flake until you check the API log.

   sharp's defaults assume a machine with room to spare:

     cache        libvips keeps decoded images, file handles and operation
                  results in memory indefinitely. Every avatar processed adds to
                  it and nothing evicts. Across a run of uploads the resident set
                  climbs until an unrelated read() is the call that happens to
                  fail.

     concurrency  one worker thread PER CPU by default, and each holds its own
                  buffers. On the 2-core VPS this deploys to (DEPLOY.md) that is
                  already the wrong trade: avatar processing is a rare,
                  latency-tolerant operation on the same box that serves every
                  page. Spending cores and memory to make it faster is paying in
                  the currency the storefront needs under a WhatsApp storm.

   cache(false) rather than a smaller cache: there is nothing to reuse here. Each
   upload is a different image, processed once, never seen again. A cache with a
   0% hit rate is pure resident memory. */
sharp.cache(false);
sharp.concurrency(1);

/* PROFILE PHOTO PROCESSING (Step 13).

   ══════════════════════════════════════════════════════════════════════════════
   THE ORIGINAL FILE IS NEVER STORED. That is the whole point of this module.
   ══════════════════════════════════════════════════════════════════════════════
   A photo taken on a phone carries EXIF, and EXIF carries GPS. A tutor uploading
   a selfie taken at their kitchen table is uploading the coordinates of their
   home, to a public page, in a product used by children. It also carries the
   device model, the software, and often a timestamp accurate to the second.

   The strip is a RE-ENCODE, not a field deletion. Deleting the tags you know
   about leaves the ones you do not — maker notes, XMP blocks, thumbnail images
   with their own embedded EXIF (a stripped photo whose EMBEDDED THUMBNAIL still
   has the GPS is a real and well-documented failure). sharp decodes to raw pixels
   and re-encodes, so nothing but pixels survives by construction.

   `.rotate()` before resizing is load-bearing rather than cosmetic: it applies
   the EXIF orientation tag while that tag still exists. Strip first and every
   photo taken in portrait on an iPhone lands sideways forever.

   THREE FIXED SIZES, generated once at upload. Resizing per request would put
   image decoding on a hot path that anyone can hit, which is a cheap way to hand
   someone a CPU-exhaustion lever on a 2-core VPS. */

/** The sizes rendered anywhere in the product. Square, because every avatar slot
    is. Names are what the storage path uses, so changing one is a migration. */
export const AVATAR_SIZES = [
  { name: "sm", px: 64 },   // review bylines, booking rows
  { name: "md", px: 160 },  // storefront header, dashboard
  { name: "lg", px: 320 },  // retina for md, and any future larger slot
] as const;

export type AvatarSizeName = (typeof AVATAR_SIZES)[number]["name"];

/** A decoded, stripped, resized image ready to be written. */
export type ProcessedAvatar = { name: AvatarSizeName; bytes: Buffer };

export type AvatarFailure = "bad-image" | "image-too-small";

/* Below this, upscaling produces a blur that looks like a broken upload rather
   than a low-quality one. Refusing is kinder than silently publishing mush. */
const MIN_SOURCE_PX = 160;

/* A decompression-bomb ceiling. A 100-megapixel PNG is a few hundred KB on the
   wire and gigabytes in memory, so the byte-size limit on the upload does not
   protect the process — the pixel count is the thing to bound. */
const MAX_SOURCE_PIXELS = 40_000_000;

/** Decode, strip, square-crop and re-encode to every size. Never throws. */
export async function processAvatar(
  input: Buffer,
): Promise<{ ok: true; value: ProcessedAvatar[] } | { ok: false; error: AvatarFailure }> {
  try {
    /* limitInputPixels bounds the DECODE, which is where a decompression bomb
       does its damage — after this line the pixels are already in memory. */
    const image = sharp(input, { limitInputPixels: MAX_SOURCE_PIXELS, failOn: "error" });
    const meta = await image.metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (!w || !h) return { ok: false, error: "bad-image" };
    if (Math.min(w, h) < MIN_SOURCE_PX) return { ok: false, error: "image-too-small" };

    const out: ProcessedAvatar[] = [];
    for (const size of AVATAR_SIZES) {
      const bytes = await sharp(input, { limitInputPixels: MAX_SOURCE_PIXELS })
        /* Apply the orientation tag BEFORE it is discarded, or every portrait
           photo from a phone ends up on its side. */
        .rotate()
        .resize(size.px, size.px, { fit: "cover", position: "attention" })
        /* WEBP for everything. One output format means one Content-Type to serve
           and one thing the read path can be wrong about; and re-encoding is what
           guarantees the metadata is gone, so there is no "pass the original
           through if it is already small" shortcut to be tempted by. */
        .webp({ quality: 82 })
        .toBuffer();
      out.push({ name: size.name, bytes });
    }
    return { ok: true, value: out };
  } catch {
    /* Anything sharp refuses to decode is simply not an image, whatever the magic
       bytes said. Returning a code rather than throwing keeps the endpoint's
       200-with-a-reason convention. */
    return { ok: false, error: "bad-image" };
  }
}

/** Storage path for one size. POSIX separators always — see storage.ts. */
export function avatarObjectPath(tutorId: string, stamp: number, name: AvatarSizeName): string {
  return ["avatars", tutorId, `${stamp}-${name}.webp`].join("/");
}
