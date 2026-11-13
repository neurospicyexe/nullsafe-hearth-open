#!/usr/bin/env node
// Regression check for the 2026-05-09 audit (HEARTH-A: H1, H2, H3, H12), extended 2026-10-08 (P3-3d).
//
// Halseth state is live (sessions, SOMA, growth, drift). Any cached fetch leaks
// stale companion mind-shape into the dashboard. Two checks:
//
//   1. The banned pattern from the prod incident: `next: { revalidate: N }` anywhere in app/ lib/
//      components/.
//   2. Any server-side fetch whose URL is built on the Halseth base (a template literal starting
//      with `${base}`, `${base()}`, `${BASE()}`, `${url}`, `${env.url}`, `${HALSETH_URL}`, or
//      `process.env.HALSETH_URL`; every one of those names is a HALSETH_URL alias in this repo)
//      must carry `cache: "no-store"` inside the SAME call. Next 15 no longer caches fetch by
//      default, but the route handlers here are the proxy layer for every client mutation and the
//      intent must be explicit, not inherited from a framework default that has already flipped once.
//      Browser fetches to /api/* in client components are not Halseth-base calls and are not scanned.
//
// Run via: node scripts/check-no-revalidate.mjs
// CI usage: chain into build (prebuild), exit 1 on any find.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const repoRoot   = dirname(__dirname);

const SCAN_DIRS  = ['app', 'lib', 'components'];
const SKIP_DIRS  = new Set(['node_modules', '.next', 'dist', '__tests__']);
const SCAN_EXT   = new Set(['.ts', '.tsx']);
const BAD_RE     = /next\s*:\s*\{\s*revalidate/;

// A fetch call whose first argument is rooted at the Halseth base.
const HALSETH_FETCH_RE = /\bfetch\w*\(\s*(`\$\{\s*(?:base(?:\(\))?|BASE\(\)|env\.url|HALSETH_URL|halsethUrl|url)\s*\}|process\.env\.HALSETH_URL)/g;
const NO_STORE_RE = /cache\s*:\s*["'`]no-store["'`]/;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (SCAN_EXT.has(extname(entry)) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

// From the index of the `(` that opens the fetch call, return the index just past its matching `)`.
// Skips over string/template literals so a `)` inside a URL or body does not close the call early.
function callEnd(src, openParen) {
  let depth = 0;
  let i = openParen;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const q = ch;
      i += 1;
      while (i < src.length && src[i] !== q) {
        if (src[i] === '\\') i += 1;
        else if (q === '`' && src[i] === '$' && src[i + 1] === '{') {
          // template expression: balance braces
          let d = 0;
          while (i < src.length) {
            if (src[i] === '{') d += 1;
            else if (src[i] === '}') { d -= 1; if (d === 0) break; }
            i += 1;
          }
        }
        i += 1;
      }
    } else if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i += 1;
    } else if (ch === '/' && src[i + 1] === '*') {
      i = src.indexOf('*/', i + 2);
      if (i < 0) return src.length;
      i += 1;
    } else if (ch === '(') {
      depth += 1;
    } else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
    i += 1;
  }
  return src.length;
}

function lineOf(src, idx) {
  return src.slice(0, idx).split('\n').length;
}

export function findHalsethFetchesWithoutNoStore(src) {
  const out = [];
  HALSETH_FETCH_RE.lastIndex = 0;
  let m;
  while ((m = HALSETH_FETCH_RE.exec(src)) !== null) {
    const openParen = src.indexOf('(', m.index);
    const end = callEnd(src, openParen);
    const call = src.slice(m.index, end);
    if (!NO_STORE_RE.test(call)) {
      out.push({ line: lineOf(src, m.index), src: call.split('\n')[0].trim() });
    }
    HALSETH_FETCH_RE.lastIndex = Math.max(HALSETH_FETCH_RE.lastIndex, openParen + 1);
  }
  return out;
}

const revalidateOffenders = [];
const noStoreOffenders = [];
for (const d of SCAN_DIRS) {
  const root = join(repoRoot, d);
  for (const file of walk(root)) {
    const src = readFileSync(file, 'utf8');
    src.split('\n').forEach((line, i) => {
      if (BAD_RE.test(line)) revalidateOffenders.push({ file, line: i + 1, src: line.trim() });
    });
    for (const o of findHalsethFetchesWithoutNoStore(src)) {
      noStoreOffenders.push({ file, ...o });
    }
  }
}

if (revalidateOffenders.length === 0 && noStoreOffenders.length === 0) {
  console.log('✓ no banned `next: { revalidate ... }` pattern and every Halseth-base fetch carries `cache: "no-store"` (app/ lib/ components/)');
  process.exit(0);
}

if (revalidateOffenders.length > 0) {
  console.error(`✗ found ${revalidateOffenders.length} banned cache pattern(s):`);
  for (const o of revalidateOffenders) console.error(`  ${o.file}:${o.line}  ${o.src}`);
}
if (noStoreOffenders.length > 0) {
  console.error(`✗ found ${noStoreOffenders.length} Halseth-base fetch(es) without \`cache: "no-store"\`:`);
  for (const o of noStoreOffenders) console.error(`  ${o.file}:${o.line}  ${o.src}`);
}
console.error('');
console.error('Halseth fetches must use `cache: \'no-store\'` (see lib/halseth.ts H1 / CLAUDE.md).');
process.exit(1);
