// Makes (B62): pure helpers for the shelf and the download proxy. No React, no fetching.
import type { CompanionId, Make, MakeKind } from "./halseth";
import { COMPANION_IDS, COMPANION_NAME } from "./companion-page";

/** A make id is 32 hex; an old generated image is img_<callId> (also 32 hex). Nothing else gets upstream. */
export const MAKE_ID_RE = /^(img_)?[0-9a-f]{32}$/;
export const MAKE_WHICH = ["source", "file", "preview"] as const;
export type MakeWhich = (typeof MAKE_WHICH)[number];

export function isMakeId(id: string): boolean {
  return MAKE_ID_RE.test(id);
}
export function isMakeWhich(w: string): w is MakeWhich {
  return (MAKE_WHICH as readonly string[]).includes(w);
}

export const KIND_LABEL: Record<MakeKind, string> = {
  writing: "writing",
  page: "page",
  music_code: "beat",
  drawing: "drawing",
  scad: "3D model",
  music_audio: "song",
  video: "video",
  image: "image",
};

const ORIGIN_LABEL: Record<string, string> = { letter: "letter", exploration: "night exploration" };

/** The kind word on a card: a captured letter or night exploration says so; everything else is its kind. */
export function kindLabel(m: Pick<Make, "kind" | "origin_kind">): string {
  if (m.kind === "writing" && m.origin_kind && ORIGIN_LABEL[m.origin_kind]) return ORIGIN_LABEL[m.origin_kind]!;
  return KIND_LABEL[m.kind] ?? m.kind;
}

export function makeUrl(id: string, which: MakeWhich, inline = false): string {
  return `/api/makes/${id}/${which}${inline ? "?inline=1" : ""}`;
}

export interface MakeLinks {
  /** The thing to download: the made file, or the source when the source is the make. */
  download: { href: string; label: string } | null;
  /** Shown only when there is both a rendered file and a source (drawing svg, scad). */
  source: { href: string; label: string } | null;
}

export function makeLinks(m: Make): MakeLinks {
  if (m.status !== "ready") return { download: null, source: null };
  const hasFile = !!m.files.file;
  const hasSource = !!m.files.source;
  if (hasFile) {
    return {
      download: { href: makeUrl(m.id, "file"), label: "Download" },
      source: hasSource ? { href: makeUrl(m.id, "source"), label: "Download source" } : null,
    };
  }
  if (hasSource) return { download: { href: makeUrl(m.id, "source"), label: "Download" }, source: null };
  return { download: null, source: null };
}

/** Which image to show inline for a kind, or null. SVG is never shown from source; the PNG stands in. */
export function inlineImage(m: Make): string | null {
  if (m.status !== "ready") return null;
  if (m.kind === "drawing" || m.kind === "image") return m.files.file ? makeUrl(m.id, "file", true) : null;
  if (m.kind === "scad") return m.files.preview ? makeUrl(m.id, "preview", true) : null;
  return null;
}

/** Kinds whose source text is written by hand as code: shown under "How it was made". */
const CODE_KINDS: ReadonlySet<MakeKind> = new Set<MakeKind>(["drawing", "scad", "page", "music_code"]);

/**
 * Which makes the shelf page fetches source text for: a ready writing (shown as the make itself) and any
 * code make with a source (shown under "How it was made", rendered as escaped text, never run).
 */
export function needsSource(m: Make): boolean {
  if (m.kind === "writing") return m.status === "ready";
  return CODE_KINDS.has(m.kind) && !!m.files.source;
}

export interface Recipe {
  /** One plain sentence: what it was made with. */
  line: string;
  /** What the model was handed, word for word (music_audio / video). */
  prompt: string | null;
  lyrics: string | null;
  /** Small facts: "45 seconds", "instrumental", "tall (9:16)". */
  facts: string[];
  /** True when the card should show the hand-written code. */
  showsCode: boolean;
  codeLabel: string | null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

/** How a make was made, from its kind and the recipe Halseth keeps. Null for writing (the text is the how). */
export function makeRecipe(m: Make): Recipe | null {
  const p = m.params ?? {};
  const base = { prompt: null, lyrics: null, facts: [] as string[], showsCode: false, codeLabel: null };
  switch (m.kind) {
    case "music_audio": {
      const facts: string[] = [];
      if (typeof p.duration === "number" && Number.isFinite(p.duration)) facts.push(`${Math.round(p.duration)} seconds`);
      if (p.instrumental === true) facts.push("instrumental");
      return {
        ...base,
        line: "Written as a description, then turned into sound by ACE-Step, a music model.",
        prompt: str(p.prompt),
        lyrics: str(p.lyrics),
        facts,
      };
    }
    case "video": {
      const facts: string[] = [];
      if (p.aspect === "9:16") facts.push("tall (9:16)");
      else if (p.aspect === "16:9") facts.push("wide (16:9)");
      return {
        ...base,
        line: "Written as a description, then turned into moving pictures by FastWan 2.2, a video model.",
        prompt: str(p.prompt),
        facts,
      };
    }
    case "drawing":
      return {
        ...base,
        line: "Drawn in SVG: every shape written out as code, then turned into a picture by rsvg.",
        showsCode: !!m.files.source,
        codeLabel: "The drawing, as it was written",
      };
    case "scad":
      return {
        ...base,
        line: "Written in OpenSCAD, code that describes a solid shape. OpenSCAD built the printable model and the preview from it.",
        showsCode: !!m.files.source,
        codeLabel: "The model, as it was written",
      };
    case "page":
      return {
        ...base,
        line: "A small web page, written by hand in HTML.",
        showsCode: !!m.files.source,
        codeLabel: "The page, as it was written",
      };
    case "music_code":
      return {
        ...base,
        line: "Music written as Strudel code, a language for playing patterns. Your browser plays it live.",
        showsCode: !!m.files.source,
        codeLabel: "The beat, as it was written",
      };
    case "image":
      return { ...base, line: "Made by an image model from a written description.", prompt: str(m.title) };
    default:
      return null;
  }
}

/** Same-origin routes that serve companion-made code with its own strict CSP, framed sandboxed. */
export function playerUrl(kind: "page" | "music_code", id: string): string {
  return `/api/makes/${kind === "page" ? "page" : "player"}?id=${id}`;
}

// These routes are excluded from next.config's global headers and set their own. `sandbox allow-scripts`
// in the CSP keeps the document in an opaque origin even if someone opens the URL directly.
const FRAME_BASE = "default-src 'none'; sandbox allow-scripts; frame-ancestors 'self'";
export const PAGE_CSP = `${FRAME_BASE}; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:`;
// Strudel compiles every pattern with eval ('unsafe-eval') and loads its effects worklet from a data: URL;
// without both, nothing ever sounded (found 11-10). The frame is still an opaque-origin sandbox and
// connect-src is unchanged, so neither widens what a pattern can reach.
export const PLAYER_CSP =
  `${FRAME_BASE}; script-src 'unsafe-inline' 'unsafe-eval' blob: data: https://unpkg.com; style-src 'unsafe-inline'; ` +
  "connect-src https://unpkg.com https://raw.githubusercontent.com https://strudel.b-cdn.net; worker-src blob:; media-src blob:";
export const FRAME_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "private, no-store",
} as const;

/** JSON for a <script> body: JSON.stringify plus the characters that could end the script or the line. */
function scriptSafe(value: string): string {
  const esc: Record<string, string> = {
    "<": "\\u003c", ">": "\\u003e", "&": "\\u0026",
    "\u2028": "\\u2028", "\u2029": "\\u2029",
  };
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (c) => esc[c]);
}

// COUPLED (2026-11-10): the bots run every music_code make through nullsafe-discord's checker BEFORE it
// lands, pinned to the same @strudel 1.1.0 packages and the same sample bank as this player's prebake
// (packages/shared make-check.ts, strudel-rules.ts DIRT_SAMPLES). Bump this version or change the prebake
// below only together with those, or the checker passes what this player cannot play.
export const STRUDEL_SRC = "https://unpkg.com/@strudel/web@1.1.0";

/**
 * The player shell for a music_code make, served by /api/makes/player into a sandboxed iframe.
 * The pattern is data (a JSON script block, never executed as markup), evaluated only on the play click.
 * Per the @strudel/web README: initStrudel() once, evaluate(code) to play, hush() to stop.
 */
export function strudelShell(code: string): string {
  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:12px;font:16px system-ui,sans-serif;background:#24201b;color:#f1e9dc;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  button{min-height:44px;min-width:88px;border-radius:12px;border:1px solid #e9ad48;background:transparent;color:#e9ad48;font:inherit;cursor:pointer}
  #msg{color:#b3a897;font-size:14px}
</style>
<script src="${STRUDEL_SRC}"></script>
<script type="application/json" id="code">${scriptSafe(code)}</script>
<button id="play" type="button">play</button>
<button id="stop" type="button">stop</button>
<span id="msg"></span>
<script>
  var CODE = JSON.parse(document.getElementById("code").textContent);
  var msg = document.getElementById("msg");
  var ready = null;
  var repl = null;
  var evalError = null;
  function boot() {
    // evaluate() never rejects: the repl hands errors to onEvalError and resolves, so without this hook
    // a broken pattern read "playing" in silence. The prebake loads the default drum/sample bank.
    if (!ready) ready = Promise.resolve(initStrudel({
      prebake: function () { return samples("github:tidalcycles/dirt-samples"); },
      onEvalError: function (e) { evalError = e; },
    })).then(function (r) { repl = r; return r; });
    return ready;
  }
  // Stop through the repl itself, never the global hush: the first evaluate() overwrites window.hush
  // with the pattern-scope hush, which only clears registered patterns and leaves the clock running, so
  // the stop button did nothing (found 11-10).
  function stopNow() { if (repl) repl.stop(); }
  function fail(e) { msg.textContent = "could not play: " + (e && e.message ? e.message : e); }
  document.getElementById("play").addEventListener("click", function () {
    msg.textContent = "loading";
    evalError = null;
    Promise.resolve().then(boot).then(function () { return evaluate(CODE); }).then(function () {
      if (evalError) { try { stopNow(); } catch (e) {} fail(evalError); } else { msg.textContent = "playing"; }
    }).catch(fail);
  });
  document.getElementById("stop").addEventListener("click", function () {
    try { stopNow(); msg.textContent = "stopped"; } catch (e) { msg.textContent = ""; }
  });
</script>
`;
}

export interface RecentMake {
  key: string;
  companion: CompanionId;
  name: string;
  kind: string;
  title: string;
  href: string;
  at: string;
}

const RECENT_MAKE_DAYS = 14;

/**
 * The home strip's "made lately": ready makes from the last two weeks across the three shelves, newest first.
 * Independent of interests (a make with no interest link has no thinking line, so it never reached home).
 * Old generated images (img_ ids) stay in the Gallery.
 */
export function recentMakes(
  shelves: Partial<Record<CompanionId, Make[] | null>>,
  now: Date,
  max = 4,
): RecentMake[] {
  const cutoff = now.getTime() - RECENT_MAKE_DAYS * 86_400_000;
  const out: RecentMake[] = [];
  for (const c of COMPANION_IDS) {
    for (const m of shelves[c] ?? []) {
      if (m.status !== "ready" || m.id.startsWith("img_")) continue;
      const t = Date.parse(m.created_at.includes("T") ? m.created_at : m.created_at.replace(" ", "T") + "Z");
      if (!Number.isFinite(t) || t < cutoff) continue;
      out.push({
        key: m.id, companion: c, name: COMPANION_NAME[c], kind: kindLabel(m),
        title: m.title, href: `/companions/${c}/made#make-${m.id}`, at: m.created_at,
      });
    }
  }
  out.sort((a, b) => Date.parse(b.at.replace(" ", "T") + "Z") - Date.parse(a.at.replace(" ", "T") + "Z"));
  return out.slice(0, max);
}
