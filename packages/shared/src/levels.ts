/* SCHOOL LEVELS a tutor teaches — Phase A · A18.7 (lane L5).

   There was no level field anywhere. tutors.level defaulted to 'Bac', no code path
   ever wrote it, and so every tutor in the catalogue was labelled "Bac" — on the
   storefront, and in Explore's search (typing "bac" matched every tutor).

   Now: CANONICAL CODES, stored as codes (tutors.levels text[], classes.level text —
   0027_levels.sql) and translated only when displayed. Order is the Tunisian
   school ladder, not alphabetical. Pure module — safe in the barrel, on the
   client, and in plain unit tests.

   These are deliberately NOT the student levels (STUDENT_LEVELS in ./types:
   primaire · college · lycee · bac · superieur · autre). The founder's list for
   tutors is Primaire · Collège · Secondaire · Bac · Université; studentToLevel()
   below bridges the two for any future matching. */
import type { Valid } from "./validation";
import type { Locale } from "./types";

export const LEVEL_CODES = ["primaire", "college", "secondaire", "bac", "universite"] as const;
export type LevelCode = (typeof LEVEL_CODES)[number];

export const LEVEL_LABELS: Record<LevelCode, { fr: string; ar: string }> = {
  primaire: { fr: "Primaire", ar: "ابتدائي" },
  college: { fr: "Collège", ar: "إعدادي" },
  secondaire: { fr: "Secondaire", ar: "ثانوي" },
  bac: { fr: "Bac", ar: "باك" },
  universite: { fr: "Université", ar: "جامعة" },
};

export function isLevelCode(raw: unknown): raw is LevelCode {
  return typeof raw === "string" && (LEVEL_CODES as readonly string[]).includes(raw);
}

/** The display label, in the viewer's language. */
export function levelLabel(code: LevelCode, locale: Locale): string {
  return LEVEL_LABELS[code][locale];
}

/** Known codes only, deduped, in ladder order. Anything unknown is dropped. */
export function sortLevels(raw: readonly unknown[] | null | undefined): LevelCode[] {
  const set = new Set((raw ?? []).filter(isLevelCode));
  return LEVEL_CODES.filter((c) => set.has(c));
}

/** "Collège · Bac" — or "" when there is none. Never a fallback level. */
export function levelsLabel(codes: readonly unknown[] | null | undefined, locale: Locale): string {
  return sortLevels(codes).map((c) => LEVEL_LABELS[c][locale]).join(" · ");
}

/* Free text → code. Used by 0027's backfill rules (mirrored in SQL there), by the
   Explore search ("bac" finds tutors who teach the Bac), and nowhere as a
   silent default. Accent- and case-insensitive; FR and Tunisian AR spellings. */
const ALIASES: Record<string, LevelCode> = {
  primaire: "primaire", ecole: "primaire", "ecole primaire": "primaire", ابتدائي: "primaire", "الابتدائي": "primaire",
  college: "college", "enseignement de base": "college", اعدادي: "college", "الاعدادي": "college",
  secondaire: "secondaire", lycee: "secondaire", ثانوي: "secondaire", "الثانوي": "secondaire", معهد: "secondaire",
  bac: "bac", baccalaureat: "bac", باك: "bac", "الباك": "bac", باكالوريا: "bac", "الباكالوريا": "bac",
  universite: "universite", universitaire: "universite", superieur: "universite", "enseignement superieur": "universite",
  fac: "universite", جامعة: "universite", جامعي: "universite", "الجامعة": "universite",
};

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Latin accents
    .replace(/[ً-ْـ]/g, "") // Arabic harakat, shadda, tatweel
    .replace(/[إأآ]/g, "ا")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function levelFromText(raw: string | null | undefined): LevelCode | null {
  if (!raw) return null;
  const key = fold(raw);
  if (isLevelCode(key)) return key;
  return ALIASES[key] ?? null;
}

/** A student's level (STUDENT_LEVELS) on the tutor ladder, or null for "autre". */
export function studentToLevel(s: string | null | undefined): LevelCode | null {
  switch (s) {
    case "primaire": return "primaire";
    case "college": return "college";
    case "lycee": return "secondaire";
    case "bac": return "bac";
    case "superieur": return "universite";
    default: return null;
  }
}

/** A tutor's levels from a form: an array of codes. Unknown code → refused. */
export function parseLevels(raw: unknown): Valid<LevelCode[]> {
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  if (!Array.isArray(raw) || raw.length > LEVEL_CODES.length * 2) return { ok: false, error: "invalid-level" };
  if (!raw.every(isLevelCode)) return { ok: false, error: "invalid-level" };
  return { ok: true, value: sortLevels(raw) };
}

/** A class's level: optional, one code. "" / null / undefined → null. */
export function parseClassLevel(raw: unknown): Valid<LevelCode | null> {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: null };
  return isLevelCode(raw) ? { ok: true, value: raw } : { ok: false, error: "invalid-level" };
}
