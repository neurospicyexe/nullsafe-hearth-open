#!/usr/bin/env node
// Fails the build if a delisted or hardcoded model id appears in Hearth source.
//
// Why this exists: Phase 0 (2026-07-28) found `deepseek-chat` -- DELISTED at the DeepSeek API,
// which serves exactly deepseek-v4-flash and deepseek-v4-pro -- hardcoded in 7 places, fixed them,
// and added source scans to halseth and nullsafe-discord. Hearth was the third repo and never got
// one, so three live call sites survived (app/api/phoenix/chat x2, app/api/phoenix/ritual x1) and
// were only found on 2026-07-29 while tracing something else. This closes the shape.
//
// The failure is quiet by nature, which is the whole argument for a scan: `deepseek-chat` still
// ROUTES (it resolves to deepseek-v4-flash) but with reasoning DISABLED, so Hearth's companions ran
// a different variant from the Discord bots' with no error anywhere. Accidental substrate
// divergence that no test would ever have caught.
//
// Run: node scripts/check-model-ids.mjs   (wired into `npm test` via check:models)

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SCAN_DIRS = ["app", "lib", "components", "scripts"];
const EXTS = new Set([".ts", ".tsx", ".mjs", ".js"]);

// Model ids that must never appear in source. Keyed by id so the message can say why.
const BANNED = [
  {
    id: "deepseek-chat",
    why: "DELISTED (GET /v1/models serves only deepseek-v4-flash / deepseek-v4-pro). It still routes, but with REASONING DISABLED -- a silent substrate divergence, not an error.",
  },
  {
    id: "deepseek-reasoner",
    why: "DELISTED. Use deepseek-v4-pro.",
  },
  {
    id: "deepseek-v3",
    why: "DELISTED.",
  },
];

// The one allowed model id, and the single module that may name it.
const ALLOWED_ID = "deepseek-v4-flash";
const ALLOWED_ID_HOME = join("lib", "phoenix-chat.ts");

// Files exempt from the id checks, by exact path. Deliberately an allowlist of NAMED files rather
// than a glob over `__tests__` -- a new test file that hardcodes a model id should still fail. Both
// entries have to name the ids to do their job:
//   - this scan declares them in its own tables
//   - the guard test asserts the constant is NOT a delisted alias, which requires spelling them
const EXEMPT = new Set([
  join("scripts", "check-model-ids.mjs"),
  join("lib", "__tests__", "phoenix-deepseek.test.ts"),
]);

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXTS.has(name.slice(name.lastIndexOf(".")))) out.push(full);
  }
  return out;
}

const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));
const failures = [];

for (const file of files) {
  const rel = relative(ROOT, file).split("/").join(sep);
  if (EXEMPT.has(rel)) continue;
  const src = readFileSync(file, "utf8");
  const lines = src.split(/\r?\n/);

  lines.forEach((line, i) => {
    // Comments are documentation, not calls -- a comment explaining WHY an id is banned
    // must not itself trip the scan.
    const code = line.replace(/\/\/.*$/, "").replace(/\/\*[\s\S]*?\*\//g, "");

    for (const { id, why } of BANNED) {
      if (code.includes(`"${id}"`) || code.includes(`'${id}'`) || code.includes(`\`${id}\``)) {
        failures.push({ rel, line: i + 1, msg: `banned model id "${id}" -- ${why}`, text: line.trim() });
      }
    }

    // Even the CORRECT id must live in exactly one place, so "which model" has one authority
    // (Phase 1: one place to change each thing). Import HEARTH_DEEPSEEK_MODEL instead.
    if (rel !== ALLOWED_ID_HOME
        && (code.includes(`"${ALLOWED_ID}"`) || code.includes(`'${ALLOWED_ID}'`))) {
      failures.push({
        rel, line: i + 1,
        msg: `model id "${ALLOWED_ID}" is hardcoded here -- import HEARTH_DEEPSEEK_MODEL from @/lib/phoenix-chat instead (one authority)`,
        text: line.trim(),
      });
    }
  });
}

if (failures.length > 0) {
  console.error(`\ncheck-model-ids: ${failures.length} violation(s)\n`);
  for (const f of failures) {
    console.error(`  ${f.rel}:${f.line}`);
    console.error(`    ${f.msg}`);
    console.error(`    > ${f.text}\n`);
  }
  process.exit(1);
}

// A scan that silently matches nothing is worse than no scan: it reports success forever.
// Assert the one legitimate declaration is actually present and reachable.
const homeSrc = readFileSync(join(ROOT, ALLOWED_ID_HOME), "utf8");
if (!homeSrc.includes(`"${ALLOWED_ID}"`)) {
  console.error(
    `\ncheck-model-ids: vacuous scan -- ${ALLOWED_ID_HOME} no longer declares "${ALLOWED_ID}".\n` +
    `Either the constant moved (update ALLOWED_ID_HOME) or the model changed (update ALLOWED_ID).\n`
  );
  process.exit(1);
}
// An exempt path that no longer exists is dead permission. Harmless today (it matches nothing) but
// it rots the allowlist into noise, and the point of naming files instead of globbing is that the
// list stays readable.
for (const ex of EXEMPT) {
  try { statSync(join(ROOT, ex)); } catch {
    console.error(`\ncheck-model-ids: EXEMPT lists ${ex}, which does not exist. Remove it or fix the path.\n`);
    process.exit(1);
  }
}
if (files.length < 20) {
  console.error(`\ncheck-model-ids: vacuous scan -- only ${files.length} files walked. Check SCAN_DIRS/ROOT.\n`);
  process.exit(1);
}

console.log(`check-model-ids: ok (${files.length} files scanned, model id declared once in ${ALLOWED_ID_HOME})`);
