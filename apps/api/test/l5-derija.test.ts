import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dict } from "../../web/lib/i18n";

/* Phase A · Arabic Derija (lane L5). The Arabic must be TUNISIAN Derija, not MSA
   and not Algerian (TNAJEM_DERIJA.md). "أرسل الرمز" on every login button is MSA
   ("ابعث الكود"), and "راك إنت" on the verification screen is Algerian. These pin
   the two named fixes and keep the common MSA forms out of the shared dictionary. */

const here = dirname(fileURLToPath(import.meta.url));

/** Every string in the AR dictionary, plural helpers sampled at 0, 1, 2 and 5. */
function strings(node: unknown, out: string[] = []): string[] {
  if (typeof node === "string") out.push(node);
  else if (typeof node === "function") for (const n of [0, 1, 2, 5]) out.push(String((node as (n: number) => unknown)(n)));
  else if (node && typeof node === "object") for (const v of Object.values(node)) strings(v, out);
  return out;
}

/* MSA (or Algerian) forms, each with its Tunisian replacement in the lane log. */
const MSA = [
  "أرسل", "الرمز", "راك إنت", "جاري", "تم ", "حصل خطأ", "عرض الكل", "التالي",
  "هذه", "انضمّ", "ابحث", "أنشئ", "إعادة", "تبدأ", "ابدأ", "يبدأ", "أضف", "اصنع",
  /* "مباشر" as LIVE only (دايركت). "تخلّص أستاذك مباشرة" means "pay directly" and is
     lane L3's payment copy — not a live-class word, not touched here. */
  "المباشر", "للمباشر", "حصص مباشرة", "حصة مباشرة", "معاينة مباشرة", "أستاذك، مباشرة",
];

describe("Derija — the Arabic is Tunisian", () => {
  test("the login button says ابعث الكود", () => {
    assert.equal(dict.ar.auth.sendCode, "ابعث الكود");
  });

  test("the verification screen no longer says راك إنت", () => {
    const verify = readFileSync(resolve(here, "../../web/components/onboarding/VerifyInner.tsx"), "utf8");
    assert.doesNotMatch(verify, /راك إنت/);
  });

  test("no common MSA form is left in the AR dictionary", () => {
    const found = strings(dict.ar).flatMap((s) => MSA.filter((m) => s.includes(m)).map((m) => `${m} ← ${s}`));
    assert.deepEqual(found, []);
  });
});
