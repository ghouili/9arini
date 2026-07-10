import type { Metadata } from "next";
import { Space_Grotesk, Plus_Jakarta_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import type { ReactNode } from "react";
import { LocaleProvider } from "@/components/LocaleProvider";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const body = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-body" });
const arabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-ar" });

export const metadata: Metadata = {
  title: "9arini — apprends avec ton prof",
  description: "Trouve un prof en direct, du primaire au Bac — toutes les matières, avec des profs tunisiens vérifiés. Première séance offerte. Paie en dinar.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" dir="ltr" className={`${display.variable} ${body.variable} ${arabic.variable}`}>
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
