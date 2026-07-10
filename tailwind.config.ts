import type { Config } from "tailwindcss";

/* Tailwind maps onto the existing 9arini design tokens (globals.css :root) via
   CSS variables, so utilities like bg-cobalt / text-ink / border-line stay in
   sync with the design system. Preflight is OFF — globals.css already provides
   the reset, and preflight would clobber the custom-styled pages. */
const v = (name: string) => `var(--${name})`;

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        ink: v("ink"), ink2: v("ink2"), muted: v("muted"),
        blue: v("blue"), cobalt: v("blue"), blue700: v("blue700"), blue50: v("blue50"),
        sand: v("sand"), cream: v("cream"), paper: v("paper"),
        ochre: v("ochre"), ochre600: v("ochre600"), amber: v("amber"),
        green: v("green"), green50: v("green50"), rose: v("rose"), rose50: v("rose50"),
        line: v("line"), lineCool: v("lineCool"),
      },
      fontFamily: {
        display: [v("fd")],
        body: [v("fb")],
        ar: [v("fa")],
      },
      borderRadius: {
        "brand-sm": "var(--r-s)",
        brand: "var(--r)",
        "brand-lg": "var(--r-l)",
        "brand-xl": "var(--r-xl)",
      },
      boxShadow: {
        "brand-sm": "var(--sh-s)",
        brand: "var(--sh)",
        "brand-lg": "var(--sh-l)",
      },
    },
  },
  plugins: [],
} satisfies Config;
