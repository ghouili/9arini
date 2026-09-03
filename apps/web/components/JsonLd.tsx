import type { ReactElement } from "react";

/* Server component that emits a JSON-LD <script>. Server-only so structured data
   ships in the first HTML payload (crawlers + AI assistants read it without running
   JS), and so the truth-rule gating (e.g. AggregateRating only when real reviews
   exist) is decided on the server from real data — never fabricated on the client.

   SECURITY: JSON.stringify does NOT escape "<", so a tutor bio containing
   "</script>" or "<!--" could break out of the script element. Escaping "<" to its
   \\u003c unicode form (valid inside a JSON string, inert as markup) closes that
   XSS/breakout hole. The data here is partly user-controlled (tutor name/bio). */
export function JsonLd({ data }: { data: object | object[] }): ReactElement {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
