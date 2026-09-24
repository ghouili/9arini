/* SUBJECTS AS CANONICAL CODES — Phase A · A18.12 (lane L5).

   /student/welcome saved the chip LABEL in whatever language the page was in, so
   one student's subjects could read "Maths,فيزياء" — half French, half Arabic, and
   unmatchable. Subjects are now stored as codes and translated only when shown.

   A value that maps to no code is KEPT as typed (bounded, comma-free), never
   dropped: it was the student's own input, and display falls back to it.
   0028_subject_codes.sql converts stored rows with the same table of labels.
   Pure module — safe in the barrel, on the client and in unit tests. */
import type { Locale } from "./types";

export const SUBJECT_CODES = [
  "math", "physique", "svt", "francais", "anglais", "arabe",
  "histoire-geo", "philosophie", "informatique", "economie", "technique",
] as const;
export type SubjectCode = (typeof SUBJECT_CODES)[number];

export const SUBJECT_LABELS: Record<SubjectCode, { fr: string; ar: string }> = {
  math: { fr: "Maths", ar: "رياضيات" },
  physique: { fr: "Physique", ar: "فيزياء" },
  svt: { fr: "SVT", ar: "علوم الحياة" },
  francais: { fr: "Français", ar: "فرنسية" },
  anglais: { fr: "Anglais", ar: "إنقليزية" },
  arabe: { fr: "Arabe", ar: "عربية" },
  "histoire-geo": { fr: "Histoire-Géo", ar: "تاريخ وجغرافيا" },
  philosophie: { fr: "Philosophie", ar: "فلسفة" },
  informatique: { fr: "Informatique", ar: "إعلامية" },
  economie: { fr: "Économie", ar: "اقتصاد" },
  technique: { fr: "Technique", ar: "تقني" },
};

export function isSubjectCode(raw: unknown): raw is SubjectCode {
  return typeof raw === "string" && (SUBJECT_CODES as readonly string[]).includes(raw);
}

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Latin accents
    .replace(/[ً-ْـ]/g, "") // Arabic harakat, shadda, tatweel
    .replace(/[إأآ]/g, "ا")
    .replace(/ڨ/g, "ق")
    .toLowerCase()
    .replace(/[\s_]+/g, " ")
    .trim();
}

/* Every label the product has ever shown for a subject (welcome chips, Explore
   chips, both languages), folded. Mirrored in 0028_subject_codes.sql. */
const ALIASES: Record<string, SubjectCode> = {
  maths: "math", math: "math", mathematiques: "math", رياضيات: "math", "الرياضيات": "math",
  physique: "physique", "physique-chimie": "physique", فيزياء: "physique", "الفيزياء": "physique",
  svt: "svt", "sciences de la vie et de la terre": "svt", "علوم الحياة": "svt", علوم: "svt",
  francais: "francais", فرنسية: "francais", "الفرنسية": "francais", فرنساوي: "francais",
  anglais: "anglais", انقليزية: "anglais", "الانقليزية": "anglais", انجليزية: "anglais",
  arabe: "arabe", عربية: "arabe", "العربية": "arabe",
  "histoire-geo": "histoire-geo", "histoire geo": "histoire-geo", "histoire-geographie": "histoire-geo",
  "histoire geographie": "histoire-geo", histoire: "histoire-geo",
  "تاريخ وجغرافيا": "histoire-geo", "تاريخ-جغرافيا": "histoire-geo", "تاريخ و جغرافيا": "histoire-geo",
  philosophie: "philosophie", philo: "philosophie", فلسفة: "philosophie", "الفلسفة": "philosophie",
  informatique: "informatique", اعلامية: "informatique", "الاعلامية": "informatique",
  economie: "economie", اقتصاد: "economie", "الاقتصاد": "economie",
  technique: "technique", تقني: "technique", تقنية: "technique",
};

/** A label or code, in either language → its code; null when it is none of them. */
export function subjectCodeFrom(raw: string | null | undefined): SubjectCode | null {
  if (!raw) return null;
  const key = fold(raw);
  if (isSubjectCode(key)) return key;
  return ALIASES[key] ?? null;
}

/** What to store for a list of subjects: codes where they map, the trimmed raw
    value where they don't — comma-free, ≤ 40 chars each, deduped, at most 8. */
export function normalizeSubjects(list: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const x of list) {
    if (typeof x !== "string") continue;
    const clean = x.replace(/,/g, " ").trim().slice(0, 40);
    if (!clean) continue;
    const v = subjectCodeFrom(clean) ?? clean;
    if (!out.includes(v)) out.push(v);
    if (out.length >= 8) break;
  }
  return out;
}

/** Display: a code in the viewer's language; anything else exactly as stored. */
export function subjectLabel(value: string, locale: Locale): string {
  return isSubjectCode(value) ? SUBJECT_LABELS[value][locale] : value;
}
