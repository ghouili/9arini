/* detectContactInfo — finding contact details hidden in user-authored text.

   ══════════════════════════════════════════════════════════════════════════════
   THE CEILING IS HONEST, AND LOW ON PURPOSE.
   ══════════════════════════════════════════════════════════════════════════════
   A tutor can read a number aloud on Jitsi and nothing here will ever stop them.
   This is not an attempt at that. The goal is to move contact exchange OFF the
   default path so that doing it becomes a deliberate, visible act rather than the
   obvious next step. No gold-plating: every rule below earns its place by
   catching something a normal person would actually type.

   ══════════════════════════════════════════════════════════════════════════════
   FALSE POSITIVES ARE AS IMPORTANT AS DETECTION.
   ══════════════════════════════════════════════════════════════════════════════
   This runs on bios, class titles and reviews written by real tutors, in a
   country where "Bac 2025", "Exercice 24", "15h30", "50 TND" and "Chapitre 3"
   are ordinary. A filter that rejects those is a filter a tutor works around by
   giving up on the product. Every numeric rule here is written to exclude them,
   and contact-info.test.ts pins each one.

   ══════════════════════════════════════════════════════════════════════════════
   WHAT IS RETURNED — PATTERN CLASSES, NEVER THE RAW MATCH.
   ══════════════════════════════════════════════════════════════════════════════
   `matches` carries the kind of thing found and where, not the text. The whole
   point of the feature is not to move contact details around; a moderation log
   that stores the phone number it caught has copied the phone number into a
   second table. masked() is the only function that touches the raw text, and it
   returns text with the details REMOVED. */

export type ContactKind =
  | "phone"
  | "email"
  | "url"
  | "social-handle"
  | "social-platform"
  | "spelled-digits";

export type ContactMatch = {
  kind: ContactKind;
  /** Index into the ORIGINAL string, so a caller can highlight without storing. */
  start: number;
  end: number;
};

export type ContactScan = {
  found: boolean;
  /** Distinct kinds found, sorted, for logging. Never the matched text. */
  kinds: ContactKind[];
  matches: ContactMatch[];
};

/* ── Digit normalisation ──────────────────────────────────────────────────────
   Arabic-Indic (٠١٢…) and Extended Arabic-Indic (۰۱۲…) digits are what an
   Arabic keyboard produces. Treating them as text rather than digits would let
   "٩٨١٢٣٤٥٦" through a rule that catches "98123456". Positions are preserved:
   every replacement is exactly one character. */
const AR_DIGITS = /[٠-٩۰-۹]/g;
function normaliseDigits(s: string): string {
  return s.replace(AR_DIGITS, (d) => {
    const c = d.charCodeAt(0);
    const base = c >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(c - base);
  });
}

/* Letter-for-digit swaps, the oldest trick there is: "9812 34 56" written as
   "98I2 E4 5b". Only the unambiguous ones, and only INSIDE a run that already
   looks like a number — applying these to prose would turn "Bac" into "8ac".
   o/O -> 0, l/I -> 1, e/E -> 3, S -> 5, b -> 6, B -> 8, g/q -> 9. */
const LOOKALIKE: Record<string, string> = {
  o: "0", O: "0", l: "1", I: "1", "|": "1", e: "3", E: "3",
  S: "5", b: "6", B: "8", g: "9", q: "9",
};

/* ── Tunisian mobile numbers ──────────────────────────────────────────────────
   Eight digits beginning 2, 4, 5 or 9 (Tunisie Telecom / Ooredoo / Orange), with
   an optional +216 / 00216 / 216 country code, and any run of separators between
   groups: spaces, dots, dashes, slashes, non-breaking spaces.

   WHY IT CANNOT MATCH A YEAR OR A PRICE: it requires EIGHT digits after an
   optional country code. "Bac 2025" is four. "50 TND" is two. "Exercice 24" is
   two. "15h30" is two groups of two separated by a letter, and the separator
   class deliberately excludes letters. The only eight-digit strings a tutor
   normally writes are phone numbers. */
const SEP = "[\\s.\\-/\\u00A0\\u202F]*";
const PHONE_RE = new RegExp(
  /* NOT PART OF A LONGER NUMBER. A Tunisian mobile is exactly eight digits, and
     without these lookarounds any long digit run contains one: a 13-digit
     timestamp like 1788627438123 has "27438123" sitting inside it, so a class
     titled "E2E Published <Date.now()>" was rejected as a phone number. Order
     references, ISBNs and IDs are all the same shape. */
  `(?<!\\d)` +
    // country code, optional
    `(?:(?:\\+|00)${SEP}216${SEP})?` +
    // 8 digits starting 2/4/5/9, separators allowed between any of them
    `[2459](?:${SEP}\\d){7}` +
    `(?!\\d)`,
  "g",
);

/* Spelled-out numbers. Someone determined enough writes "zero six" or
   "صفر تسعة". Requiring SIX consecutive number-words keeps ordinary prose out —
   "les trois premiers chapitres" is one, "deux heures" is one. */
const NUM_WORDS_FR = "z[ée]ro|un|deux|trois|quatre|cinq|six|sept|huit|neuf";
const NUM_WORDS_AR = "صفر|واحد|اثنين|ثلاثة|أربعة|خمسة|ستة|سبعة|ثمانية|تسعة";
const SPELLED_RE = new RegExp(
  `(?:(?:${NUM_WORDS_FR}|${NUM_WORDS_AR})[\\s,.\\-]+){5,}(?:${NUM_WORDS_FR}|${NUM_WORDS_AR})`,
  "giu",
);

/* Email, including the evasions people actually type: "a (at) b (dot) com",
   "a [at] b . com", "a AT b DOT com". */
/* Whitespace is allowed AROUND each separator, not just inside it. Without that
   outer \s*, "amine (at) example (dot) com" fails to match at all — the local
   part cannot absorb the space before "(at)" — which is the single most common
   way people write an address they know is being filtered. */
const AT = "(?:\\s*@\\s*|\\s*\\(\\s*at\\s*\\)\\s*|\\s*\\[\\s*at\\s*\\]\\s*|\\s*\\{\\s*at\\s*\\}\\s*|\\s+at\\s+)";
const DOT = "(?:\\s*\\.\\s*|\\s*\\(\\s*dot\\s*\\)\\s*|\\s*\\[\\s*dot\\s*\\]\\s*|\\s*\\{\\s*dot\\s*\\}\\s*|\\s+dot\\s+)";
const EMAIL_RE = new RegExp(
  `[\\p{L}\\d._%+-]+${AT}[\\p{L}\\d.-]+${DOT}\\p{L}{2,}`,
  "giu",
);

/* Messaging platforms by NAME, in both scripts and in Derija transliteration.
   Naming the app is the message; the handle usually follows in the next line, or
   in a screenshot we cannot read anyway. */
const PLATFORM_RE =
  /(whats\s*app|wa\.me|واتساب|واتس اب|telegram|t\.me|تلغرام|تيليجرام|viber|signal\b|messenger|instagram|insta\b|انستا|انستغرام|snap\s*chat|سناب|tiktok|تيك توك|facebook|فيسبوك|\bfb\b|discord|skype|zoom\.us|imo\b)/giu;

/* An @handle. Requires 3+ characters so it cannot fire on "@" alone, and is
   anchored to a non-word boundary so an email's local part is not double-counted
   (the email rule already covers that case and reports it more precisely). */
const HANDLE_RE = /(?<![\w@.])@[a-z0-9._]{3,}/gi;

/* Any URL off a short allow-list. YouTube only: it is the one link a tutor has a
   real teaching reason to share, and Step 10 stores video IDs rather than links.
   Everything else — a personal site, a Linktree, a Google Form — is a route off
   the platform. */
/* Three shapes, and the third is the delicate one:
     1. an explicit scheme, or a www. prefix   -> always a link
     2. a bare domain on a short TLD list      -> "mon-site.tn"
     3. any bare domain FOLLOWED BY A PATH     -> "linktr.ee/amine"

   Shape 3 requires the slash. Without it "…la fin.Le chapitre" reads as the
   domain "fin.Le", and French prose is full of a word, a full stop and a capital
   letter with no space between them. Demanding a path is what keeps ordinary
   sentences out while still catching the link shorteners that actually matter. */
const URL_RE = /(?:https?:\/\/|www\.)[^\s<>()]+|\b[\p{L}\d][\p{L}\d-]*\.(?:tn|com|net|org|fr|io|me|co|app|link|page)\b(?:\/[^\s<>()]*)?|\b[\p{L}\d][\p{L}\d-]*\.[a-z]{2,6}\/[^\s<>()]*/giu;
const URL_ALLOW = /(?:^|\.)(?:youtube\.com|youtu\.be|youtube-nocookie\.com)$/i;

function hostOf(raw: string): string | null {
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withScheme).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/* A SCHOOL YEAR IS NOT A PHONE NUMBER.

   "Programme officiel 2024-2025" is eight digits beginning with 2, separated by a
   character the phone pattern accepts — so it matched, and a tutor could not
   write the single most ordinary phrase in Tunisian tutoring. Same for
   "annales 2023 2024".

   The test is narrow on purpose: EXACTLY two groups, each EXACTLY four digits,
   each a plausible year. A real number never splits 4-4 (Tunisian mobiles are
   written 2-2-2-2, 3-3-2, or solid), so this cannot be used to smuggle one
   through — "9812 3456" is caught, because 9812 is not a year. */
function isYearRange(raw: string): boolean {
  const groups = raw.split(/\D+/).filter(Boolean);
  return groups.length === 2 && groups.every((g) => /^(?:19|20)\d{2}$/.test(g));
}

/** Apply letter-for-digit swaps only inside runs that are already digit-heavy. */
function deLookalike(s: string): string {
  return s.replace(/[\dA-Za-z|]{6,}|[\dA-Za-z|]+(?:[\s.\-/]+[\dA-Za-z|]+){2,}/g, (run) => {
    const digits = (run.match(/\d/g) ?? []).length;
    const letters = (run.match(/[A-Za-z|]/g) ?? []).length;
    // Only when it reads as a number with a few characters swapped in.
    if (digits < 4 || letters > digits) return run;
    return run.replace(/[oOlI|eESbBgq]/g, (ch) => LOOKALIKE[ch] ?? ch);
  });
}

/** Scan user-authored text for anything that could reach a person off-platform. */
export function detectContactInfo(input: string | null | undefined): ContactScan {
  const text = input ?? "";
  if (!text.trim()) return { found: false, kinds: [], matches: [] };

  /* Two views of the same string, both POSITION-PRESERVING so an index found in
     either maps back to the original. normaliseDigits swaps one char for one
     char; deLookalike only ever substitutes single characters too. */
  const digits = normaliseDigits(text);
  const swapped = deLookalike(digits);

  const matches: ContactMatch[] = [];
  const push = (kind: ContactKind, start: number, end: number) => {
    matches.push({ kind, start, end });
  };

  const scan = (re: RegExp, kind: ContactKind, source: string, keep?: (m: string) => boolean) => {
    re.lastIndex = 0;
    for (const m of source.matchAll(re)) {
      if (m.index === undefined) continue;
      if (keep && !keep(m[0])) continue;
      push(kind, m.index, m.index + m[0].length);
    }
  };

  /* Email FIRST: an address contains dots and would otherwise be reported as a
     URL too, which tells a moderator less, not more. */
  scan(EMAIL_RE, "email", digits);

  scan(URL_RE, "url", digits, (raw) => {
    const host = hostOf(raw);
    return host !== null && !URL_ALLOW.test(host);
  });

  /* Phones on the lookalike-corrected view, so "98I2 34 56" is caught. Digits at
     least 8 long are required by the pattern itself; year ranges are excluded
     because "2024-2025" has exactly that shape. */
  scan(
    PHONE_RE,
    "phone",
    swapped,
    (raw) => (raw.match(/\d/g) ?? []).length >= 8 && !isYearRange(raw),
  );

  scan(SPELLED_RE, "spelled-digits", digits);
  scan(PLATFORM_RE, "social-platform", digits);
  scan(HANDLE_RE, "social-handle", digits);

  /* Overlaps resolve by SPECIFICITY, not by length.

     "www.facebook.com/amine" and "wa.me/21698123456" match both the URL rule and
     the platform rule, and the URL match is longer — so sorting by length kept
     the vaguer answer. A moderator reading "social-platform" learns what happened;
     "url" makes them go and look. Lower number wins. */
  const PRIORITY: Record<ContactKind, number> = {
    email: 0,
    "social-platform": 1,
    phone: 2,
    "spelled-digits": 3,
    "social-handle": 4,
    url: 5,
  };
  const sorted = [...matches].sort(
    (a, b) => PRIORITY[a.kind] - PRIORITY[b.kind] || a.start - b.start || b.end - a.end,
  );
  const kept: ContactMatch[] = [];
  for (const m of sorted) {
    // Drop anything overlapping a match we already kept at higher specificity.
    if (!kept.some((k) => m.start < k.end && k.start < m.end)) kept.push(m);
  }
  kept.sort((a, b) => a.start - b.start);

  return {
    found: kept.length > 0,
    kinds: [...new Set(kept.map((m) => m.kind))].sort(),
    matches: kept,
  };
}

/** True when the text carries anything that could reach a person off-platform. */
export function hasContactInfo(input: string | null | undefined): boolean {
  return detectContactInfo(input).found;
}

/** Replace every match with `replacement`, leaving the rest of the text intact.

    For channels where hard rejection is the wrong answer — a message or a
    review, where losing the whole text loses the point the person was making.
    Rejection is for fields the author can trivially re-edit (bio, title). */
export function maskContactInfo(input: string | null | undefined, replacement = "[masqué]"): string {
  const text = input ?? "";
  const { matches } = detectContactInfo(text);
  if (matches.length === 0) return text;
  let out = "";
  let cursor = 0;
  for (const m of [...matches].sort((a, b) => a.start - b.start)) {
    if (m.start < cursor) continue; // overlapping; already covered
    out += text.slice(cursor, m.start) + replacement;
    cursor = m.end;
  }
  return out + text.slice(cursor);
}
