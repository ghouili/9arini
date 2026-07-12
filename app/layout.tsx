import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Plus_Jakarta_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import type { ReactNode } from "react";
import { LocaleProvider } from "@/components/LocaleProvider";
import { JsonLd } from "@/components/JsonLd";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const body = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-body" });
const arabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-ar" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://9arini.tn";
const DESCRIPTION =
  "Trouve un prof en direct, du primaire au Bac — toutes les matières, avec des profs tunisiens vérifiés. Première séance offerte. Paie en dinar.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "9arini — apprends avec ton prof",
    template: "%s · 9arini",
  },
  description: DESCRIPTION,
  applicationName: "9arini",
  keywords: ["cours particuliers", "prof", "Tunisie", "Bac", "soutien scolaire", "9arini", "قرّيني", "دروس خصوصية"],
  authors: [{ name: "9arini" }],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    siteName: "9arini",
    locale: "fr_TN",
    alternateLocale: ["ar_TN"],
    url: SITE_URL,
    title: "9arini — apprends avec ton prof",
    description: DESCRIPTION,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "9arini — ton prof, en direct." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "9arini — apprends avec ton prof",
    description: DESCRIPTION,
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0E5AA6",
  colorScheme: "light",
};

/* Pre-hydration locale bootstrap.
   The locale lives client-side (LocaleProvider → localStorage "9arini.locale"), so the
   server can't know it while rendering <html>. This blocking script runs BEFORE first
   paint and stamps lang/dir on the document, so Arabic loads straight into RTL with no
   LTR flash. LocaleProvider's own effect keeps it in sync on every later switch.
   <html> carries suppressHydrationWarning because this script legitimately mutates the
   attributes React rendered on the server (same pattern as next-themes). */
const LOCALE_BOOTSTRAP = `(function(){try{var l=localStorage.getItem("9arini.locale");if(l!=="ar"&&l!=="fr")l="fr";var e=document.documentElement;e.lang=l;e.dir=l==="ar"?"rtl":"ltr";}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="fr"
      dir="ltr"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${arabic.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: LOCALE_BOOTSTRAP }} />
      </head>
      <body>
        {/* Site-wide structured data. Truthful + static: identifies the 9arini entity
            and the site to search engines and AI assistants. No SearchAction yet —
            /explore filtering is client-side, so a search endpoint would be a claim
            we can't back; add it when search is URL-driven (bilingual fast-follow). */}
        <JsonLd
          data={[
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "9arini",
              alternateName: "قرّيني",
              url: SITE_URL,
              logo: `${SITE_URL}/apple-touch-icon.png`,
              description: DESCRIPTION,
              areaServed: { "@type": "Country", name: "Tunisia" },
              knowsLanguage: ["fr", "ar"],
            },
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "9arini",
              alternateName: "قرّيني",
              url: SITE_URL,
              inLanguage: ["fr", "ar"],
            },
          ]}
        />
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
