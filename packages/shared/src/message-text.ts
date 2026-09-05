/* MESSAGE TEXT — the one stored-XSS surface in the product.

   A message is user-authored, persisted, and rendered to a DIFFERENT user. That
   combination is what makes it dangerous: a bio only ever attacks the person who
   wrote it, but a message attacks whoever it was sent to, from a source they have
   a reason to trust.

   ══════════════════════════════════════════════════════════════════════════════
   DEFENCE IN DEPTH, and both halves are load-bearing.
   ══════════════════════════════════════════════════════════════════════════════
     IN   sanitiseMessageBody() strips markup before the row is written, so the
          database never holds a tag. If a future surface renders messages
          somewhere unescaped — an email digest, a moderation console, a CSV
          export — there is nothing there to execute.
     OUT  React escapes text nodes. `messages.body` must NEVER be handed to
          dangerouslySetInnerHTML. There is no formatting feature here; if one is
          ever added, it renders from a parsed representation, not from this
          string.

   Stripping alone would be too clever to rely on: escaping alone would leave a
   live payload sitting in the database waiting for the first consumer that
   forgets. Doing both means either one failing is not a breach.

   THIS IS NOT A SANITISER FOR RICH TEXT. It does not try to keep "safe" tags,
   because there are no safe tags here — the product renders plain text. Anything
   that looks like markup is removed rather than negotiated with, which is the
   only version of this that is simple enough to be obviously correct. */

/** Longest message we accept. Long enough for a real explanation of a problem,
    short enough that nobody pastes a document into a chat box. */
export const MESSAGE_MAX_LENGTH = 2000;

export type MessageTextResult =
  | { ok: true; value: string }
  | { ok: false; error: "message-empty" | "message-too-long" };

/* Control characters, minus the ones that are legitimately text: \n (0A) and
   \t (09). \r is normalised away below rather than kept. Zero-width and
   bidi-override characters go too: U+202E can visually reverse a rendered
   string, which is how a masked number gets read back the other way round. */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/** Strip markup and normalise whitespace. Returns PLAIN TEXT, always. */
export function sanitiseMessageBody(input: string | null | undefined): string {
  let s = String(input ?? "");

  s = s.replace(/\r\n?/g, "\n");

  /* Remove script and style CONTENT, not just their tags: dropping the tags
     alone would leave `alert(1)` sitting in the message as visible text, which
     is at best confusing and at worst still executable if some future consumer
     re-wraps it. */
  s = s.replace(/<(script|style|iframe|object|embed|template)\b[\s\S]*?<\/\1\s*>/gi, " ");
  /* An unclosed <script> never reaches its closing tag, so the rule above misses
     it. Drop everything from such an opener to the end. */
  s = s.replace(/<(script|style|iframe|object|embed|template)\b[\s\S]*$/i, " ");
  // HTML comments, CDATA and doctypes.
  s = s.replace(/<!--[\s\S]*?-->/g, " ").replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, " ").replace(/<![\s\S]*?>/g, " ");
  // Any remaining tag, opening or closing, complete or not.
  s = s.replace(/<\/?[a-z][^>]*>/gi, " ");
  /* A lone "<" left by an unterminated tag. Kept as a literal "<" would be fine
     for React, but the database is read by more than React. */
  s = s.replace(/<[^>]*$/g, " ");

  s = s.replace(CONTROL, "").replace(INVISIBLE, "");

  /* Collapse runs of blank lines and trailing spaces. Someone pressing Enter
     forty times should not own forty screens of another person's inbox. */
  s = s
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return s;
}

/** Sanitise and enforce the bounds. The single entry point for a message write. */
export function parseMessageBody(input: string | null | undefined): MessageTextResult {
  const value = sanitiseMessageBody(input);
  if (!value) return { ok: false, error: "message-empty" };
  /* Measured AFTER sanitising, so 3000 characters of markup that reduces to
     "hi" is accepted rather than refused for a length the user never wrote. */
  if (value.length > MESSAGE_MAX_LENGTH) return { ok: false, error: "message-too-long" };
  return { ok: true, value };
}
