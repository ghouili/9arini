import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  detectContactInfo,
  hasContactInfo,
  maskContactInfo,
  publicProfile,
  publicDisplayName,
  publicInitials,
  contactFieldPaths,
} from "@tnajem/shared";

/* ══════════════════════════════════════════════════════════════════════════════
   FALSE POSITIVES FIRST, and deliberately before the detection cases.

   This filter runs on bios, class titles and reviews written by Tunisian tutors.
   "Bac 2025", "Exercice 24", "15h30", "50 TND", "Chapitre 3" are ordinary
   sentences here. A filter that rejects them is one a tutor routes around by
   abandoning the product, and the damage is invisible: nobody files a bug for
   "I gave up on writing my bio".
   ══════════════════════════════════════════════════════════════════════════════ */
describe("MUST NOT FLAG — ordinary tutor copy", () => {
  const clean = [
    "Bac 2025",
    "Révisions Bac 2024 et 2025",
    "Exercice 24, page 118",
    "Séance à 15h30",
    "50 TND la séance",
    "Chapitre 3 : les intégrales",
    "Prof de maths depuis 2015",
    "Groupes de 4 à 8 élèves",
    "Programme officiel 2024-2025",
    "J'ai 12 ans d'expérience",
    "Note moyenne 18/20 au bac blanc",
    "Séances de 90 minutes",
    "Niveaux : 7ème, 8ème, 9ème",
    "دروس الباك 2025",
    "تمرين 24 صفحة 118",
    "الحصة على 15 و 30 دقيقة",
    "20 دينار للحصة",
    "خبرة 12 سنة",
    "من 4 لـ 8 تلامذة",
    // Long-ish prose with numbers scattered through it.
    "Je prépare les élèves de terminale au bac depuis 2015. Mes séances durent 90 minutes et coûtent 25 TND. On travaille sur les annales de 2023, 2024 et 2025.",
  ];

  for (const text of clean) {
    test(JSON.stringify(text.slice(0, 46)), () => {
      const scan = detectContactInfo(text);
      assert.equal(
        scan.found,
        false,
        `flagged as ${scan.kinds.join(",")} — a tutor cannot write this sentence`,
      );
    });
  }
});

describe("MUST NOT FLAG — edge cases that look numeric", () => {
  test("empty and blank input", () => {
    for (const v of ["", "   ", null, undefined]) {
      assert.equal(detectContactInfo(v).found, false);
    }
  });
  test("a 7-digit run is not a Tunisian mobile", () => {
    assert.equal(hasContactInfo("Référence 9812345"), false);
  });
  test("8 digits that do NOT start 2/4/5/9", () => {
    // 8 digits, but no Tunisian mobile begins with 3 or 7.
    assert.equal(hasContactInfo("Code 31234567"), false);
  });
  test("a year range is not a number", () => {
    assert.equal(hasContactInfo("2024-2025"), false);
  });
  test("a LONG digit run is not a phone number", () => {
    /* Every 13-digit timestamp contains an 8-digit substring starting 2/4/5/9 —
       1788627438123 holds "27438123". Without the lookarounds this rejected a
       class titled `E2E Published ${Date.now()}`, and would reject any order
       reference, ISBN or id a tutor pasted. */
    assert.equal(hasContactInfo("E2E Published 1788627438123"), false);
    assert.equal(hasContactInfo("Référence 123456789012345"), false);
  });
  test("...but an 8-digit number inside a sentence still is", () => {
    // The lookarounds must not have disabled the rule they are protecting.
    assert.equal(hasContactInfo("mon num 98123456 stp"), true);
  });
  test("a price list", () => {
    assert.equal(hasContactInfo("25 TND, 40 TND, 60 TND"), false);
  });
  test("YouTube is allowed — it is the one link with a teaching reason", () => {
    assert.equal(hasContactInfo("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), false);
    assert.equal(hasContactInfo("https://youtu.be/dQw4w9WgXcQ"), false);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   DETECTION
   ══════════════════════════════════════════════════════════════════════════════ */
describe("phone numbers", () => {
  const phones = [
    "98123456",
    "+216 98 123 456",
    "0021698123456",
    "216 98 123 456",
    "98 12 34 56",
    "98.12.34.56",
    "98-12-34-56",
    "22 123 456",
    "50123456",
    "41234567",
    "Appelle-moi au 98123456 stp",
    "رقمي ٩٨١٢٣٤٥٦",          // Arabic-Indic digits
    "98I2 34 56",                // letter-for-digit swap
    "9812E456",
  ];
  for (const p of phones) {
    test(JSON.stringify(p), () => {
      const scan = detectContactInfo(p);
      assert.equal(scan.found, true, "missed");
      assert.ok(scan.kinds.includes("phone"), `kinds were ${scan.kinds.join(",")}`);
    });
  }
});

describe("emails, including the evasions people actually type", () => {
  const emails = [
    "amine@example.com",
    "amine (at) example (dot) com",
    "amine [at] example [dot] com",
    "amine AT example DOT com",
    "Écris-moi : prof.maths+bac@gmail.com",
  ];
  for (const e of emails) {
    test(JSON.stringify(e), () => {
      const scan = detectContactInfo(e);
      assert.equal(scan.found, true, "missed");
      assert.ok(scan.kinds.includes("email"), `kinds were ${scan.kinds.join(",")}`);
    });
  }
});

describe("platforms, handles and links off the allow-list", () => {
  const cases: [string, string][] = [
    ["Contacte-moi sur WhatsApp", "social-platform"],
    ["wa.me/21698123456", "social-platform"],
    ["واتساب", "social-platform"],
    ["Mon telegram : t.me/aminemaths", "social-platform"],
    ["انستا", "social-platform"],
    ["Suis-moi @aminemaths", "social-handle"],
    ["https://mon-site.tn/cours", "url"],
    ["linktr.ee/amine", "url"],
    ["www.facebook.com/amine", "social-platform"],
  ];
  for (const [text, kind] of cases) {
    test(`${JSON.stringify(text)} -> ${kind}`, () => {
      const scan = detectContactInfo(text);
      assert.equal(scan.found, true, "missed");
      assert.ok(scan.kinds.includes(kind as never), `kinds were ${scan.kinds.join(",")}`);
    });
  }
});

describe("spelled-out digits", () => {
  test("six or more number-words in a row is a phone number", () => {
    assert.equal(hasContactInfo("zero six deux trois quatre cinq sept huit"), true);
  });
  test("but ordinary counting is not", () => {
    assert.equal(hasContactInfo("les trois premiers chapitres, puis deux exercices"), false);
  });
});

describe("the scan reports PATTERN CLASSES, never the matched text", () => {
  test("nothing in the result echoes the number", () => {
    const scan = detectContactInfo("appelle 98123456 ou amine@example.com");
    const serialised = JSON.stringify(scan);
    assert.ok(!serialised.includes("98123456"), "the raw phone leaked into the scan result");
    assert.ok(!serialised.includes("amine@example.com"), "the raw email leaked into the scan result");
    assert.deepEqual(scan.kinds, ["email", "phone"]);
  });
});

describe("maskContactInfo — for channels where rejecting loses the point", () => {
  test("removes the details and keeps the sentence", () => {
    const out = maskContactInfo("Appelle-moi au 98123456 après 18h");
    assert.ok(!out.includes("98123456"));
    assert.ok(out.includes("Appelle-moi au"));
    assert.ok(out.includes("après 18h"));
  });
  test("clean text is returned untouched", () => {
    const text = "On révise les intégrales, Bac 2025.";
    assert.equal(maskContactInfo(text), text);
  });
  test("masking twice is stable", () => {
    const once = maskContactInfo("amine@example.com et 98123456");
    assert.equal(maskContactInfo(once), once);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   THE ALLOW-LIST
   ══════════════════════════════════════════════════════════════════════════════ */
describe("publicDisplayName — first name only", () => {
  test("drops the surname entirely, not just to an initial", () => {
    assert.equal(publicDisplayName("Amine Karoui"), "Amine");
  });
  test("a single name is kept", () => {
    assert.equal(publicDisplayName("Amine"), "Amine");
  });
  test("Arabic names work", () => {
    assert.equal(publicDisplayName("أمين القروي"), "أمين");
  });
  test("a number smuggled into the name is stripped, not returned", () => {
    assert.equal(publicDisplayName("+21698123456 Amine"), null);
    assert.equal(publicDisplayName("Amine98123456"), "Amine");
  });
  test("blank-ish input is null, never an empty string", () => {
    for (const v of ["", "   ", "...", null, undefined]) {
      assert.equal(publicDisplayName(v), null, JSON.stringify(v));
    }
  });
  test("hyphenated and apostrophe names survive", () => {
    assert.equal(publicDisplayName("Jean-Pierre Dupont"), "Jean-Pierre");
  });
});

describe("publicInitials — from the FIRST name only", () => {
  test("never leaks the surname initial", () => {
    assert.equal(publicInitials("Amine Karoui"), "AM");
  });
  test("unknown name", () => {
    assert.equal(publicInitials(null), "?");
  });
});

describe("publicProfile — an allow-list, so extra fields cannot escape", () => {
  test("only name and initials come out, whatever went in", () => {
    const out = publicProfile({
      fullName: "Amine Karoui",
      // Everything below is deliberately present on the input row.
      phone: "+21698123456",
      email: "amine@example.com",
      guardianPhone: "+21620000000",
      city: "Sfax",
    } as never);
    assert.deepEqual(Object.keys(out).sort(), ["initials", "name"]);
    assert.deepEqual(out, { name: "Amine", initials: "AM" });
  });
  test("a null row is safe", () => {
    assert.deepEqual(publicProfile(null), { name: null, initials: "?" });
  });
});

describe("contactFieldPaths — the structural guard for whole payloads", () => {
  test("finds a contact-shaped key at any depth", () => {
    const paths = contactFieldPaths({
      bookings: [{ studentName: "Amine", studentPhone: "+21698123456" }],
    });
    assert.deepEqual(paths, ["bookings[0].studentPhone"]);
  });
  test("a nulled field is CLEAN — that is what a closed field looks like", () => {
    assert.deepEqual(contactFieldPaths({ studentPhone: null, studentEmail: "" }), []);
  });
  test("it matches KEYS, not values — 'Bac 2025' in a bio is not a finding", () => {
    assert.deepEqual(contactFieldPaths({ bio: "Bac 2025, 50 TND, exercice 24" }), []);
  });
});
