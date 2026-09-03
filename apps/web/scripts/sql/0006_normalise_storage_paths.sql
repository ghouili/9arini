-- 0006 — canonicalise verification_docs.storage_path to POSIX separators.
--
-- WHY: app/actions.ts built this value with node:path.join, which is
-- platform-dependent. Rows written on a Windows dev box hold
-- "verification\<tutorId>\<file>"; rows written on Linux hold
-- "verification/<tutorId>/<file>". The same logical path, stored two ways.
--
-- It is not broken today: both readers (app/api/admin/doc/[id]/route.ts and
-- lib/retention.ts) split on /[\/]+/ before resolving, deliberately. But the
-- STORED value was never canonical, so any future consumer that uses it verbatim
-- -- in a URL, in a LIKE, in a join -- silently misses half the rows. The writer
-- is fixed to emit "/" always; this brings the existing rows in line.
--
-- DO NOT rewrite the predicate as `storage_path LIKE '%\%'`. In LIKE, backslash is
-- the default ESCAPE character, so that pattern means "one literal %" and matches
-- nothing -- it would update 0 rows and report success. strpos() takes no pattern
-- and has no escape rules.
--
-- Idempotent: after the first run no row contains a backslash, so the WHERE
-- matches nothing and re-running is a no-op.

UPDATE verification_docs
   SET storage_path = replace(storage_path, chr(92), '/')
 WHERE strpos(storage_path, chr(92)) > 0;

-- Leave the readers' split(/[\/]+/) in place. It is not redundant: it is what
-- keeps an un-migrated row (a restored backup, a row written by an older build)
-- readable, and it is part of the path-containment check.
