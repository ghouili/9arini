import type { Storefront, TutorStats, Booking, ClassItem, Pack } from "./types";

/* Demo data so the app runs with zero backend. Mirrors the approved mockups
   (Bac Math tutor, Yassine). Months are short FR labels; the UI localizes via i18n where needed. */

export const demoClasses: ClassItem[] = [
  { id: "c1", tutor_id: "yassine", tutor_name: "Yassine Khelifi", title: "Intégrales — révision express", description: "Méthodes + annales. On fait 3 exercices types ensemble.", day: "23", month: "JUIN", time: "18:00", duration_min: 90, price_tnd: 15, seats: 20, seats_left: 8, is_free_first: true, status: "scheduled", meet_url: "https://meet.jit.si/9arini-c1", whiteboard_url: "https://bitpaper.io/", quiz_url: "https://www.wooclap.com/" },
  { id: "c2", tutor_id: "yassine", tutor_name: "Yassine Khelifi", title: "Annales Bac 2025 corrigées", description: "Correction guidée des sujets 2025.", day: "25", month: "JUIN", time: "17:00", duration_min: 120, price_tnd: 20, seats: 20, seats_left: 12, is_free_first: false, status: "scheduled", meet_url: "https://meet.jit.si/9arini-c2" },
];

export const demoPacks: Pack[] = [
  { id: "p1", tutor_id: "yassine", title: "Pack révision : Dérivées & Limites", meta: "42 pages · 6 vidéos", price_tnd: 8, kind: "pdf" },
];

export const demoStorefront: Storefront = {
  tutor: {
    id: "yassine", slug: "yassine-math", full_name: "Yassine Khelifi",
    subject: "Prof de Maths · Bac", level: "Bac",
    bio: "« Spécialiste révisions Bac. On révise les dérivées, intégrales et annales — en darija, à ton rythme. 1ère séance offerte. »",
    avatar_initials: "YK", rating: 4.9, students_count: 1240, verified: true,
  },
  classes: demoClasses,
  packs: demoPacks,
};

export const demoTutorStatsEmpty: TutorStats = {
  balance_tnd: 0, students: 0, sessions: 0, rating: 0, trend_pct: 0, spark: [4, 4, 5, 4, 6, 5, 7], recent: [],
};

export const demoTutorStatsEarning: TutorStats = {
  balance_tnd: 1240, students: 48, sessions: 32, rating: 4.9, trend_pct: 38,
  spark: [12, 14, 13, 20, 24, 30, 42],
  recent: [
    { id: "a1", kind: "class", title: "Intégrales — révision express", sub: "Aujourd'hui · 18 élèves", amount_tnd: 264 },
    { id: "a2", kind: "pack", title: "Pack · Dérivées & Limites", sub: "Hier · 11 ventes", amount_tnd: 77 },
    { id: "a3", kind: "class", title: "Annales Bac 2025", sub: "Lun · 22 élèves", amount_tnd: 352 },
  ],
};

export const demoStudentUpcoming: ClassItem = demoClasses[0];
export const demoStudentBookings: Booking[] = [
  { id: "b1", class: demoClasses[0], is_free: true, status: "reserved" },
];
export const demoStudentPast: { id: string; title: string; sub: string; replay_url?: string }[] = [
  { id: "r1", title: "Dérivées : exercices types", sub: "18 juin · 88 min", replay_url: "https://meet.jit.si/9arini-replay-r1" },
];
