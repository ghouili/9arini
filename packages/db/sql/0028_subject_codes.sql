-- 0028 — student subjects stored as canonical codes (Phase A · A18.12, lane L5).
--
-- /student/welcome saved the chip LABEL in the page's language, so profiles.subjects
-- (comma-joined, 0004) could hold "Maths,فيزياء" — the same student's data half
-- French, half Arabic. The API now stores codes (@tnajem/shared SUBJECT_CODES:
-- math · physique · svt · francais · anglais · arabe · histoire-geo · philosophie ·
-- informatique · economie · technique) and translates them only for display. This
-- converts the rows already stored, with the same table of labels as
-- packages/shared/src/subjects.ts.
--
-- HOW EXISTING ROWS ARE KEPT
--   • Every entry that is a known FR or AR label becomes its code; order is kept;
--     an entry repeated in two languages collapses to one code.
--   • An entry that maps to no code is KEPT exactly as typed (trimmed) — never
--     dropped. Display falls back to the raw value. To list them:
--       SELECT DISTINCT btrim(v) AS unmapped
--         FROM profiles, unnest(string_to_array(subjects, ',')) AS v
--        WHERE btrim(v) <> '' AND btrim(v) NOT IN ('math','physique','svt','francais',
--              'anglais','arabe','histoire-geo','philosophie','informatique','economie','technique');
--   • NULL and '' rows are untouched. No column is added or removed.
--
-- IDEMPOTENT: a code maps to itself, so a second run changes nothing (and the
-- UPDATE only touches rows whose value actually changes).
--
-- ROLLBACK (manual): there is no lossless inverse (two labels became one code). To
-- show labels again, map codes back to FR labels with the same VALUES table.

BEGIN;

WITH map(label, code) AS (
  VALUES
    ('maths', 'math'), ('math', 'math'), ('mathématiques', 'math'), ('mathematiques', 'math'),
    ('رياضيات', 'math'), ('الرياضيات', 'math'),
    ('physique', 'physique'), ('physique-chimie', 'physique'), ('فيزياء', 'physique'), ('الفيزياء', 'physique'),
    ('svt', 'svt'), ('علوم الحياة', 'svt'), ('علوم', 'svt'),
    ('français', 'francais'), ('francais', 'francais'), ('فرنسية', 'francais'), ('الفرنسية', 'francais'),
    ('فرنساوي', 'francais'),
    ('anglais', 'anglais'), ('إنقليزية', 'anglais'), ('انقليزية', 'anglais'), ('إنڨليزية', 'anglais'),
    ('انڨليزية', 'anglais'), ('الإنقليزية', 'anglais'), ('الانقليزية', 'anglais'), ('إنجليزية', 'anglais'),
    ('انجليزية', 'anglais'),
    ('arabe', 'arabe'), ('عربية', 'arabe'), ('العربية', 'arabe'),
    ('histoire-géo', 'histoire-geo'), ('histoire-geo', 'histoire-geo'), ('histoire-géographie', 'histoire-geo'),
    ('histoire-geographie', 'histoire-geo'), ('histoire', 'histoire-geo'),
    ('تاريخ وجغرافيا', 'histoire-geo'), ('تاريخ-جغرافيا', 'histoire-geo'), ('تاريخ و جغرافيا', 'histoire-geo'),
    ('philosophie', 'philosophie'), ('philo', 'philosophie'), ('فلسفة', 'philosophie'), ('الفلسفة', 'philosophie'),
    ('informatique', 'informatique'), ('إعلامية', 'informatique'), ('اعلامية', 'informatique'),
    ('الإعلامية', 'informatique'), ('الاعلامية', 'informatique'),
    ('économie', 'economie'), ('Économie', 'economie'), ('economie', 'economie'), ('اقتصاد', 'economie'),
    ('الاقتصاد', 'economie'),
    ('technique', 'technique'), ('تقني', 'technique'), ('تقنية', 'technique')
),
exploded AS (
  SELECT p.id, t.ord, btrim(t.val) AS val
    FROM profiles p,
         unnest(string_to_array(p.subjects, ',')) WITH ORDINALITY AS t(val, ord)
   WHERE p.subjects IS NOT NULL AND p.subjects <> ''
),
mapped AS (
  SELECT e.id, e.ord, COALESCE(m.code, e.val) AS v
    FROM exploded e
    LEFT JOIN map m ON m.label = lower(e.val) OR m.label = e.val
   WHERE e.val <> ''
),
dedup AS (
  SELECT id, v, min(ord) AS ord FROM mapped GROUP BY id, v
),
joined AS (
  SELECT id, string_agg(v, ',' ORDER BY ord) AS s FROM dedup GROUP BY id
)
UPDATE profiles p
   SET subjects = j.s
  FROM joined j
 WHERE p.id = j.id
   AND p.subjects IS DISTINCT FROM j.s;

COMMIT;
