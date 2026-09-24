import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dict } from "../../web/lib/i18n";

/* Phase A · A18.1 (lane L5). The guardian-consent form is filled in by the CHILD,
   who had to tick "Je confirme être le parent/tuteur" — a false statement, on a
   legal record, that was never even sent to the server. The form now says what
   happens instead: the parent is the one who confirms. These pin the copy and the
   form itself, so the statement cannot quietly come back. */

const here = dirname(fileURLToPath(import.meta.url));
const consentPage = readFileSync(
  resolve(here, "../../web/app/[locale]/auth/consent/page.tsx"),
  "utf8",
);

describe("A18.1 — the child never declares to be the parent", () => {
  test("no consent string (FR or AR) has the child claim to be the parent", () => {
    for (const locale of ["fr", "ar"] as const) {
      const values = Object.values(dict[locale].consent).filter((v): v is string => typeof v === "string");
      for (const v of values) {
        assert.doesNotMatch(v, /confirme être le parent|نأكّد أني الولي/, `${locale}: ${v}`);
      }
    }
  });

  test("the form says what actually happens: the parent confirms", () => {
    const fr = dict.fr.consent as Record<string, unknown>;
    const ar = dict.ar.consent as Record<string, unknown>;
    assert.equal(fr.info, "Ton parent recevra un e-mail pour confirmer.");
    assert.equal(typeof ar.info, "string");
    assert.ok(String(ar.info).length > 0);
  });

  test("the consent form renders no self-declaration checkbox", () => {
    assert.doesNotMatch(consentPage, /type="checkbox"/);
    assert.doesNotMatch(consentPage, /consent\.agree/);
  });
});
