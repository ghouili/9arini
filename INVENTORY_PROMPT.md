# Prompt for Claude Code — What do we actually have?

> Paste this as your prompt in Claude Code, from the repo root.

---

## What I want

A **simple, honest inventory** of this platform: what features exist, which of them actually
work, and what infrastructure is in place.

**This is a survey, not a work order. Do not fix anything. Do not refactor. Just report.**

---

## Rules for the report

**Be brutally honest about the difference between these three things:**
- **Code exists** — you read it
- **It compiles** — the build passes
- **It works** — you ran it and saw the result

Most of this codebase is in the first two categories. Say so. A wrong "✅ works" is worse than
an honest "code exists, never tested" — I've been burned by that already on this project.

**Use exactly these markers:**

| Marker | Meaning |
|---|---|
| ✅ | **Verified working** — I ran it and saw it work |
| 🟡 | **Partial** — works with caveats, or only in some conditions |
| ❌ | **Broken** — exists but fails |
| ⬜ | **Code exists, untested** — I read it, I didn't run it |
| ➖ | **Not built** |

**Keep it short. One line per item. No essays, no paragraphs, no recommendations.**
I want a list I can read in two minutes.

---

## What to do

1. `npm run build` — does it pass? Record the result.
2. Start the dev server. Check the database connects.
3. Walk the main flows quickly in a browser (whatever tool you have). You don't need to test
   exhaustively — just enough to mark things honestly.
4. Read `.env.local` (report which variables are **set / empty / missing** — **never print the
   values**).
5. Check `package.json`, `README.md`, `DEPLOY.md`, `SCALABILITY.md`, `scripts/`.

---

## The output — exactly these five sections

### 1 · FEATURES — student side
Table: `Feature | Status | Note (one line)`
Cover: signup/OTP, guardian consent, browsing `/explore`, tutor storefront, booking a free
session, the student dashboard, joining a live class, cancelling, leaving a review.

### 2 · FEATURES — tutor side
Cover: signup, creating the storefront, ID verification upload, admin approval, publishing a
class, publishing a pack, seeing bookings, notifications, subscription/payout screens.

### 3 · FEATURES — admin side
Cover: the verification queue, approve/reject, viewing uploaded documents, how an admin is
identified.

### 4 · INFRASTRUCTURE
Table: `Component | What we have | Status`
Cover: hosting/deployment, database (type, version, where it runs), migrations, file storage
for ID documents, authentication, SMS, live video, email, payments, cron jobs, monitoring,
error tracking, backups, CI/CD, git remote, domain, SSL.

### 5 · CONFIGURATION
Table: `Env var | Set? | What breaks without it`
List every variable the app reads. **Report set/empty/missing only — never the value.**

### 6 · THE SUMMARY — five lines maximum
- What percentage of the product actually works today, roughly
- The single biggest thing that is missing
- The single biggest thing that is broken
- Can this serve a real user today: **yes or no**
- What it would take to get to yes

---

## Do not

- Do not fix, refactor, or "improve" anything
- Do not write recommendations, roadmaps, or next steps beyond the five summary lines
- Do not mark something ✅ unless you personally ran it
- Do not print secrets or env var values
- Do not pad it. Short and honest beats long and impressive.
