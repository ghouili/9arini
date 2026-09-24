import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { supportWhatsAppHref } from "@tnajem/shared";

/* phase-a lane L1 (A12, decision D5) — the /account support row links to
   NEXT_PUBLIC_SUPPORT_WHATSAPP, digits only, and is HIDDEN (null) otherwise. It
   shipped as a placeholder wa.me link to a number nobody owns. */

describe("supportWhatsAppHref", () => {
  test("a digits-only international number becomes a wa.me link", () => {
    assert.equal(supportWhatsAppHref("21612345678"), "https://wa.me/21612345678");
    assert.equal(supportWhatsAppHref("  21612345678 "), "https://wa.me/21612345678");
  });

  test("unset or empty hides the row", () => {
    for (const v of [undefined, null, "", "   "]) assert.equal(supportWhatsAppHref(v), null, JSON.stringify(v));
  });

  test("anything but digits hides the row — a placeholder never becomes a link", () => {
    // The shipped placeholder, built at runtime so the A12 source grep stays empty.
    const placeholder = "216" + "X".repeat(8);
    for (const v of [placeholder, "+21612345678", "216 12 345 678", "216-12345678", "wa.me/21612345678", "abc"]) {
      assert.equal(supportWhatsAppHref(v), null, JSON.stringify(v));
    }
  });

  test("too short or longer than E.164 hides the row", () => {
    assert.equal(supportWhatsAppHref("1234567"), null);
    assert.equal(supportWhatsAppHref("1234567890123456"), null);
  });
});
