/* ESLint for apps/web — flat config, run by `eslint` directly.

   `next lint` was removed in Next 16, and .eslintrc is gone with ESLint 9. The
   rules and the reasons are unchanged from the .eslintrc.cjs this replaces:

   core-web-vitals is the config Next itself recommends. Two of its rules encode
   invariants this project already held BY HAND, and now holds by machine:
   no-img-element (the "next/image only" rule) and no-html-link-for-pages.

   History worth keeping: `npm run lint` once existed with NO CONFIG and no ESLint
   installed, dropped into an interactive prompt and exited 1 everywhere — a gate
   that looked like a gate and had never run once.

   SCOPE: apps/web only. packages/* and apps/api are type-checked and unit-tested;
   eslint-config-next is a React/Next config with nothing useful to say about a
   Fastify route. */
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      /* ERROR, not the default warning. A stale closure in a useEffect renders as
         "the page is showing yesterday's data", which is a real bug — and a warning
         in a repo with no lint history is a warning nobody will ever read. */
      "react-hooks/exhaustive-deps": "error",
      /* ERROR, because "no <img>, next/image only" is one of this project's stated
         invariants. The single legitimate exception (a local blob preview of an ID
         scan, which /_next/image cannot fetch) carries an inline disable that names
         the reason. */
      "@next/next/no-img-element": "error",

      /* OFF: five React Compiler rules that eslint-plugin-react-hooks 7 added with
         the Next 16 upgrade (15 Sept 2026). They describe code the compiler cannot
         optimise, and this app does not run the compiler. On the day they arrived
         they reported 29 patterns across 14 files (fetch-then-setState in effects,
         refs read in render for field focus, components declared inside
         StorefrontView, Math.random in the client-only confetti) — none a
         correctness bug. Every other compiler rule in the set passes and stays on.
         Turning one of these back on is its own change, with the refactor it needs. */
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/static-components": "off",
    },
  },
  globalIgnores([".next/**", "node_modules/**", "scripts/**", "brand/**", "next-env.d.ts"]),
]);
