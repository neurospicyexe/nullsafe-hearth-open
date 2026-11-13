import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig has jsx: preserve (Next compiles it); tests that import a .tsx module need the transformer to compile it.
  oxc: { jsx: { runtime: "automatic" } },
  // Mirrors tsconfig `@/*` -> `./*`, so a test can import modules that use the alias (middleware.ts).
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "node",
    // 2026-11-07: Node 25+ ships its own global `localStorage`, which is undefined unless
    // --localstorage-file is given, and it shadows jsdom's, so every jsdom test touching storage
    // read `undefined`. Turning Node's web storage off lets jsdom's stand. Harmless on Node 22/24.
    execArgv: ["--no-experimental-webstorage"],
    // 2026-08-23: was `lib/**/*.test.ts` only, so a test written next to the page it covers was
    // silently never collected -- green suite, zero coverage, no error anywhere. Route-level logic
    // worth testing (thread flattening in app/log) belongs beside its route, so the glob covers
    // both trees. If a new test seems to pass suspiciously fast, check it is in this list at all.
    include: ["{lib,app,components}/**/*.test.ts", "{lib,app,components}/**/*.test.tsx"],
  },
});
