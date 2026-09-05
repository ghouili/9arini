"use client";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { Book, Video } from "@/components/icons";
import { getTutorMaterials } from "@/app/actions";
import type { MaterialItem } from "@tnajem/shared";
import { youTubeEmbedUrl } from "@tnajem/shared";
import { bilingual } from "@/lib/i18n";

/* MATERIALS ON A STOREFRONT (Step 10).

   FETCHED CLIENT-SIDE, and that is a caching decision rather than a style one.
   The storefront page is ISR-cached and anonymous by construction — /[slug] is
   the surface a WhatsApp storm lands on. This list is SESSION-DEPENDENT: a
   student with a live booking sees more than a stranger. Folding it into the
   cached payload would serve one viewer's entitlements to everybody, which is the
   exact failure rule 3 in lib/api.ts exists to prevent.

   THE LIST IS ALREADY THE ACCESS DECISION. apps/api filters per viewer, so
   nothing here re-derives who may see what — a client copy of that rule is a
   second implementation of an access check. If an item is in this array, this
   viewer may have it.

   The panel renders NOTHING when the list is empty, including while loading. A
   "Documents" heading above an empty box on every storefront in the catalogue
   would be a promise of content that mostly does not exist. */

const copy = bilingual({
  fr: {
    title: "Documents et vidéos",
    sub: "Partagés par ce prof.",
    open: "Ouvrir",
    watch: "Voir la vidéo",
    forStudents: "Réservé aux élèves inscrits",
  },
  ar: {
    title: "وثائق وفيديوهات",
    sub: "منشورين من الأستاذ.",
    open: "حلّ",
    watch: "شوف الفيديو",
    forStudents: "محجوز للتلامذة المسجّلين",
  },
});

function sizeLabel(bytes?: number): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function MaterialsPanel({ slug }: { slug: string }) {
  const { locale } = useLocale();
  const c = copy[locale];
  const [items, setItems] = useState<MaterialItem[] | null>(null);
  const [openVideo, setOpenVideo] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getTutorMaterials(slug)
      .then((m) => { if (alive) setItems(m); })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [slug]);

  // Nothing to say yet, or nothing to say at all.
  if (!items || items.length === 0) return null;

  return (
    <div className="panel panel-pad mb-[clamp(14px,2vw,22px)]">
      <h2 className="font-display text-[16px] font-bold mb-1">{c.title}</h2>
      <p className="text-[13px] text-muted mb-3">{c.sub}</p>

      <ul className="flex flex-col gap-2.5" role="list">
        {items.map((m) => (
          <li key={m.id} className="flex items-start gap-3 py-2.5 border-b border-line last:border-b-0">
            <span
              aria-hidden="true"
              className="w-9 h-9 rounded-[11px] grid place-items-center flex-none bg-blue50 text-blue"
            >
              {m.kind === "youtube" ? <Video /> : <Book />}
            </span>

            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold">{m.title}</div>
              {m.description && (
                <p className="text-[13px] text-muted leading-[1.6] mt-0.5">{m.description}</p>
              )}
              <div className="text-[12px] text-muted mt-1 flex items-center gap-1.5 flex-wrap">
                {m.visibility === "students" && <span>{c.forStudents}</span>}
                {m.kind === "file" && m.sizeBytes && (
                  <>
                    {m.visibility === "students" && <span aria-hidden="true">·</span>}
                    <span>{sizeLabel(m.sizeBytes)}</span>
                  </>
                )}
              </div>
            </div>

            {m.kind === "file" ? (
              /* /api/material/[id] is a pass-through that asks the API for the
                 bytes. NOT a static URL: a static file cannot be revoked when a
                 booking is cancelled or a takedown is upheld. */
              <a
                href={`/api/material/${m.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm flex-none"
              >
                {c.open}
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setOpenVideo(openVideo === m.id ? null : m.id)}
                className="btn btn-ghost btn-sm flex-none"
                aria-expanded={openVideo === m.id}
              >
                {c.watch}
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* THE EMBED IS ALWAYS youtube-nocookie, via the one helper that builds it.
          A tracking cookie set on a page a fifteen-year-old is reading is the
          thing being avoided, and there is no second place that could get the
          host wrong. Rendered only on demand, so no third-party request is made
          until someone asks for the video. */}
      {openVideo && (
        <div className="mt-3" style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
          <iframe
            src={youTubeEmbedUrl(items.find((m) => m.id === openVideo)?.youtubeId ?? "")}
            title={items.find((m) => m.id === openVideo)?.title ?? "video"}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              border: 0, borderRadius: "var(--r-lg)",
            }}
          />
        </div>
      )}
    </div>
  );
}
