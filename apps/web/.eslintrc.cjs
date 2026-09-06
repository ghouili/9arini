/* `npm run lint` existed as a script but had NO CONFIG and NO ESLINT INSTALLED, so
   it dropped into `next lint`'s interactive setup prompt and exited 1 in every
   non-interactive context. It had therefore never run once — the same class of
   breakage as brand:build and _restart-prod.sh: a gate that looks like a gate and
   is not one.

   core-web-vitals is the config Next itself recommends. Two of its rules encode
   invariants this project already held BY HAND, and now holds by machine:
   no-img-element (the "next/image only" rule) and no-html-link-for-pages.

   .cjs, not .json: ESLint's schema rejects a top-level "//" key, so a JSON config
   cannot carry the reason it exists — and a config nobody can annotate is a config
   the next person changes blind.

   SCOPE: apps/web only. packages/* and apps/api are type-checked and unit-tested;
   eslint-config-next is a React/Next config with nothing useful to say about a
   Fastify route. */
module.exports = {
  extends: "next/core-web-vitals",
  ignorePatterns: [".next/**", "node_modules/**", "scripts/**", "brand/**"],
  rules: {
    /* ERROR, not the default warning. A stale closure in a useEffect renders as
       "the page is showing yesterday's data", which is a real bug — and a warning
       in a repo with no lint history is a warning nobody will ever read. */
    "react-hooks/exhaustive-deps": "error",
    /* ERROR, because "no <img>, next/image only" is one of this project's stated
       invariants — and next lint exits 0 on warnings, so shipping it at the
       default severity would mean the rule is documented, reported, and not
       enforced. The single legitimate exception (a local blob preview of an ID
       scan, which /_next/image cannot fetch) carries an inline disable that names
       the reason. */
    "@next/next/no-img-element": "error",
  },
};
