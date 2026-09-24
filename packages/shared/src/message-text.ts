/* MESSAGE TEXT — the one stored-XSS surface in the product.

   A message is user-authored, persisted, and rendered to a DIFFERENT user. That
   combination is what makes it dangerous: a bio only ever attacks the person who
   wrote it, but a message attacks whoever it was sent to, from a source they have
   a reason to trust.

   ══════════════════════════════════════════════════════════════════════════════
   DEFENCE IN DEPTH, and both halves are load-bearing.
   ══════════════════════════════════════════════════════════════════════════════
     IN   sanitiseMessageBody() ESCAPES & < > before the row is written, so the
          database never holds a live tag. If a future surface renders messages
          somewhere unescaped — an email digest, a moderation console, a CSV
          export — there is nothing there to execute.
     OUT  messageBodyText() turns the stored form back into the text the person
          typed, and ONLY for an escaping renderer: the API's JSON, which apps/web
          renders as a React text node. `messages.body` must NEVER be handed to
          dangerouslySetInnerHTML. There is no formatting feature here; if one is
          ever added, it renders from a parsed representation, not from this
          string.

   ESCAPE, DON'T STRIP (phase-a A20). This used to DELETE anything that looked
   like markup, and a lone "<" counted as the start of an unterminated tag: "si
   x < 5 alors" reached the other side as "si x", and "x<y et y>z" as "x z". A
   tutoring product cannot lose inequalities. Escaping loses nothing the person
   typed and is still simple enough to be obviously correct: no "<" survives in
   storage, so no tag can. Only & < > are escaped — quotes stay, because a message
   is never placed inside an attribute and French is full of apostrophes.

   THIS IS NOT A SANITISER FOR RICH TEXT. There are no safe tags here — the
   product renders plain text, and "<b>" arrives as the four characters typed. */

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

/* The three characters that can open markup or an entity, and nothing else. */
const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
const UNESCAPES: Record<string, string> = { amp: "&", lt: "<", gt: ">" };

/** Normalise control characters and whitespace. Returns the text the READER sees. */
function normaliseMessageText(input: string | null | undefined): string {
  let s = String(input ?? "");

  s = s.replace(/\r\n?/g, "\n");

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

function escapeMessageText(s: string): string {
  return s.replace(/[&<>]/g, (ch) => ESCAPES[ch] ?? ch);
}

/** Normalise, then ESCAPE & < >. Returns the STORED form: inert for any consumer. */
export function sanitiseMessageBody(input: string | null | undefined): string {
  return escapeMessageText(normaliseMessageText(input));
}

/** The stored form back to exactly what the person typed.

    Hand the result ONLY to something that escapes on render — a JSON payload that
    apps/web shows as a React text node. One pass, so "&amp;lt;" (someone who typed
    "&lt;") reads back as "&lt;", not "<". Rows written before A20 hold no entity
    they did not type, so they read back unchanged. */
export function messageBodyText(stored: string | null | undefined): string {
  return String(stored ?? "").replace(/&(amp|lt|gt);/g, (_, name: string) => UNESCAPES[name] ?? _);
}

/** Sanitise and enforce the bounds. The single entry point for a message write. */
export function parseMessageBody(input: string | null | undefined): MessageTextResult {
  const text = normaliseMessageText(input);
  if (!text) return { ok: false, error: "message-empty" };
  /* Measured on the text the READER sees, not on the escaped storage form: a
     message of 2000 "<" is 2000 characters to the person reading it, even though
     it is stored as 8000. */
  if (text.length > MESSAGE_MAX_LENGTH) return { ok: false, error: "message-too-long" };
  return { ok: true, value: escapeMessageText(text) };
}
