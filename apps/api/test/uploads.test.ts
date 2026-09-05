import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { sniffMime, parseYouTubeId, youTubeEmbedUrl } from "@tnajem/shared";

/* Magic-byte sniffing and YouTube id extraction. Both exist because a client
   string is not evidence: `mimetype` on a multipart part and a pasted URL are
   equally attacker-supplied. */

const bytes = (...b: number[]) => Buffer.from([...b, ...new Array(Math.max(0, 12 - b.length)).fill(0)]);

describe("sniffMime — what a file ACTUALLY is", () => {
  test("JPEG", () => assert.equal(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0)), "image/jpeg"));
  test("PNG", () =>
    assert.equal(sniffMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), "image/png"));
  test("PDF", () => assert.equal(sniffMime(Buffer.from("%PDF-1.7\n....")), "application/pdf"));
  test("WEBP", () => {
    const b = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP")]);
    assert.equal(sniffMime(b), "image/webp");
  });

  test("A RENAMED SCRIPT IS NOT AN IMAGE", () => {
    /* The whole point. "payload.png" whose bytes are `<script>` must not be
       accepted because the client called it image/png — the read path serves the
       STORED type, so accepting the claim is how a "PNG" gets run as HTML. */
    assert.equal(sniffMime(Buffer.from("<script>alert(1)</script>")), null);
  });
  test("an SVG is not an image here", () => {
    // SVG is XML that can carry <script>. Absent from the table on purpose.
    assert.equal(sniffMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')), null);
  });
  test("HTML is not an image", () => {
    assert.equal(sniffMime(Buffer.from("<!DOCTYPE html><html><body>hi</body></html>")), null);
  });
  test("too short to identify is null, never a guess", () => {
    assert.equal(sniffMime(Buffer.from([0xff, 0xd8])), null);
  });
  test("empty", () => assert.equal(sniffMime(Buffer.alloc(0)), null));
});

describe("parseYouTubeId — store the ID, never the URL", () => {
  const id = "dQw4w9WgXcQ";
  const accepted = [
    id,
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&t=30s`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}`,
    `https://youtu.be/${id}?t=12`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
    `youtube.com/watch?v=${id}`, // no scheme
  ];
  for (const url of accepted) {
    test(JSON.stringify(url), () => assert.equal(parseYouTubeId(url), id));
  }
});

describe("parseYouTubeId — everything else is refused", () => {
  const refused = [
    "",
    "   ",
    null,
    undefined,
    "https://vimeo.com/123456",
    "https://evil.tn/watch?v=dQw4w9WgXcQ",          // right shape, wrong host
    "https://youtube.com.evil.tn/watch?v=dQw4w9WgXcQ", // host-suffix trick
    "https://www.youtube.com/watch?v=short",         // not 11 chars
    "javascript:alert(1)",
    "not a url at all",
  ];
  for (const v of refused) {
    test(JSON.stringify(v), () => assert.equal(parseYouTubeId(v), null));
  }
});

describe("youTubeEmbedUrl — nocookie, always", () => {
  test("uses the privacy-preserving host", () => {
    /* A tracking cookie set on a page a fifteen-year-old is reading is the thing
       being avoided. There is no second embed function to get this wrong. */
    const url = youTubeEmbedUrl("dQw4w9WgXcQ");
    assert.ok(url.startsWith("https://www.youtube-nocookie.com/embed/"), url);
    assert.ok(!url.includes("youtube.com/embed"), url);
  });
  test("the id is encoded, so a crafted value cannot break out of the URL", () => {
    assert.ok(!youTubeEmbedUrl('a"><script>').includes("<script>"));
  });
});
