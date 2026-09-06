"use client";
import { useEffect, useState } from "react";
import { logout, getMe } from "@/app/actions";
import { Button } from "@/components/ui";
import { LocaleToggle } from "@/components/LocaleToggle";
import { useLocale } from "@/components/LocaleProvider";
import { Phone, User, Forward } from "@/components/icons";
import { SiteShell } from "@/components/SiteShell";
import { DeleteAccount } from "@/components/account/DeleteAccount";
import { bilingual } from "@/lib/i18n";

const WA_LINK = "https://wa.me/216XXXXXXXX";

/* Page-local copy (lib/i18n.ts is shared/read-only). */
const copy = bilingual({
  fr: { sub: "Ta langue, ton rôle, et comment nous joindre." },
  ar: { sub: "لغتك، دورك، وكيفاش تتصل بينا." },
});

export default function AccountPage() {
  const { t, locale } = useLocale();
  const c = copy[locale];
  const [me, setMe] = useState<{ name: string | null; role: string; email: string | null; phone: string | null } | null>(null);

  useEffect(() => { getMe().then(setMe).catch(() => setMe(null)); }, []);

  async function handleLogout() {
    await logout();
    window.location.href = "/";
  }

  return (
    <SiteShell>
      <section className="web-section">
        <div className="container container-narrow max-w-[760px]">

          {/* Page heading — the eyebrow used to repeat the h1 verbatim */}
          <div className="mb-[clamp(20px,_3vw,_36px)]">
            <h1 className="web-h2">{t.account.title}</h1>
            <p className="muted text-[13.5px] mt-1.5">{c.sub}</p>
          </div>

          {/* Settings panel */}
          <div className="panel panel-pad">

            {/* Avatar + identity block */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "clamp(14px, 2vw, 22px)",
                paddingBottom: "clamp(16px, 2vw, 22px)",
                borderBottom: "1px solid var(--line)",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  minWidth: 72,
                  borderRadius: 22,
                  background: "linear-gradient(150deg, var(--blue), var(--blue900))",
                  display: "grid",
                  placeItems: "center",
                  color: "#fff",
                  fontFamily: "var(--fd)",
                  fontSize: 28,
                  boxShadow: "var(--sh)",
                  flexShrink: 0,
                }}
                aria-hidden="true"
              >
                <User style={{ width: 32, height: 32, stroke: "#fff" }} />
              </div>
              <div className="flex-[1_1_160px] min-w-0">
                <div style={{ fontFamily: "var(--fd)", fontSize: "clamp(16px, 2vw, 20px)", fontWeight: 700, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {me?.name || "—"}
                </div>
                {/* The login identity first — that is what they type to get back in.
                    The phone is an optional contact and may simply not be set. */}
                {me?.email && (
                  <div dir="ltr" className="text-[14px] text-muted text-start break-all">{me.email}</div>
                )}
                {me?.phone && (
                  <div dir="ltr" className="text-[14px] text-muted text-start">{me.phone}</div>
                )}
              </div>
            </div>

            {/* Language row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "clamp(14px, 2vw, 18px) 0",
                borderBottom: "1px solid var(--line)",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span className="text-[15px] font-semibold">{t.account.language}</span>
              <LocaleToggle />
            </div>

            {/* Role row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "clamp(14px, 2vw, 18px) 0",
                borderBottom: "1px solid var(--line)",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span className="text-[15px] font-semibold">{t.account.role}</span>
              <span
                className="text-[13px] font-bold py-1.5 px-3.5 rounded-[999px] bg-blue50 text-blue shrink-0 min-h-8 inline-flex items-center"
              >
                {me?.role === "tutor" ? t.auth.asTutor : t.auth.asStudent}
              </span>
            </div>

            {/* Help / WhatsApp row */}
            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "clamp(14px, 2vw, 18px) 0",
                gap: 12,
                textDecoration: "none",
                color: "var(--ink)",
                minHeight: 44,
              }}
              aria-label={t.account.help}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 min-w-10 rounded-[11px] bg-green50 grid place-items-center shrink-0"
                  aria-hidden="true"
                >
                  <Phone style={{ width: 18, height: 18, stroke: "var(--green)" }} />
                </div>
                <span className="text-[15px] font-semibold min-w-0">{t.account.help}</span>
              </div>
              <Forward className="text-muted w-[18px] h-[18px] shrink-0" aria-hidden="true" />
            </a>

          </div>

          {/* Logout button */}
          <div className="mt-[clamp(14px,_2vw,_22px)] max-w-[320px]">
            <Button variant="ghost" onClick={handleLogout}>
              {t.account.logout}
            </Button>
          </div>

          {/* Step 15. LAST on the page, and behind a two-step confirm: the
              destructive control must never be the one under the cursor when the
              section first renders. */}
          <div className="mt-[clamp(20px,3vw,32px)]">
            <DeleteAccount />
          </div>

        </div>
      </section>
    </SiteShell>
  );
}
