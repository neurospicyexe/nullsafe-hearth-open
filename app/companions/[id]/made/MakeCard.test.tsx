// @vitest-environment jsdom
// Each make kind's card: what renders, what never does, and the sandbox on anything companion-written.
import { describe, it, expect, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Make } from "@/lib/halseth";
import { strudelShell } from "@/lib/makes";
import MakeCard from "./MakeCard";

afterEach(cleanup);

const ID = "0123456789abcdef0123456789abcdef";
const NOW = new Date("2026-11-02T12:00:00Z");
const make = (over: Partial<Make>): Make => ({
  id: ID, kind: "drawing", title: "Moss lantern", why: "it kept showing up", interest_name: "lanterns",
  status: "ready", heard_back: null, version: 1, parent_id: null, created_at: "2026-11-02T10:00:00Z",
  files: {}, ...over,
});
const html = (m: Make, source: string | null = null) =>
  renderToStaticMarkup(<ul><MakeCard make={m} source={source} now={NOW} /></ul>);

describe("downloads", () => {
  it("drawing: PNG inline, Download is the file, Download source is the svg, both with download attr", () => {
    const h = html(make({ kind: "drawing", files: { source: { ext: "svg" }, file: { mime: "image/png", ext: "png" } } }));
    expect(h).toContain(`src="/api/makes/${ID}/file?inline=1"`);
    expect(h).toContain(`href="/api/makes/${ID}/file" download=""`);
    expect(h).toContain(`href="/api/makes/${ID}/source" download=""`);
    expect(h).toContain(">Download<");
    expect(h).toContain(">Download source<");
    // a new tab, so the installed (standalone) app is never navigated onto a file with no way back
    expect(h.match(/download="" target="_blank" rel="noopener"/g)?.length).toBe(2);
    expect(h).not.toContain(`/source?inline`);
  });
  it("the card shows kind, title, why, interest, age, version and heard back", () => {
    const h = html(make({ version: 3, heard_back: "it hums", files: { file: { ext: "png" } } }));
    expect(h).toContain("drawing");
    expect(h).toContain("Moss lantern");
    expect(h).toContain("it kept showing up");
    expect(h).toContain("for lanterns");
    expect(h).toContain("version 3");
    expect(h).toContain("it hums");
    expect(h).toContain("2h");
  });
  it("a private why (null) shows no why line", () => {
    expect(html(make({ why: null, files: { file: {} } }))).not.toContain("h-make-why");
  });
});

describe("kinds", () => {
  it("image: inline file, one Download, no source link", () => {
    const h = html(make({ kind: "image", id: "img_" + ID, files: { file: { mime: "image/png" } } }));
    expect(h).toContain(`src="/api/makes/img_${ID}/file?inline=1"`);
    expect(h).not.toContain("Download source");
  });
  it("scad: preview inline, STL is the Download, source is the extra link", () => {
    const h = html(make({ kind: "scad", files: { source: {}, file: { ext: "stl" }, preview: { mime: "image/png" } } }));
    expect(h).toContain(`src="/api/makes/${ID}/preview?inline=1"`);
    expect(h).toContain(`href="/api/makes/${ID}/file" download=""`);
    expect(h).toContain("Download source");
  });
  it("scad whose preview failed still offers the STL", () => {
    const h = html(make({ kind: "scad", files: { source: {}, file: { ext: "stl" } } }));
    expect(h).not.toContain("<img");
    expect(h).toContain(`href="/api/makes/${ID}/file"`);
  });
  it("music_audio: audio controls through the inline proxy", () => {
    const h = html(make({ kind: "music_audio", files: { file: { mime: "audio/mpeg" } } }));
    expect(h).toContain("<audio");
    expect(h).toContain("controls");
    expect(h).toContain(`src="/api/makes/${ID}/file?inline=1"`);
  });
  it("video: video controls, playsinline, Download", () => {
    const h = html(make({ kind: "video", files: { file: { mime: "video/mp4" } } }));
    expect(h).toContain("<video");
    expect(h).toMatch(/playsinline/i);
    expect(h).toContain(`href="/api/makes/${ID}/file" download=""`);
  });
  it("writing: escaped text, never markup; Download is the source", () => {
    const h = html(make({ kind: "writing", files: { source: { ext: "md" } } }), '<script>alert(1)</script> **bold**');
    expect(h).toContain("&lt;script&gt;alert(1)&lt;/script&gt; **bold**");
    expect(h).not.toContain("<script>");
    expect(h).not.toContain("<strong>");
    expect(h).toContain(`href="/api/makes/${ID}/source" download=""`);
  });
  it("page: no iframe until the click, then a same-origin route framed with allow-scripts only", () => {
    const m = make({ kind: "page", files: { source: { ext: "html" } } });
    expect(html(m)).not.toContain("<iframe");
    render(<MakeCard make={m} source={null} now={NOW} />);
    expect(document.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "open it" }));
    const frame = document.querySelector("iframe")!;
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame.getAttribute("src")).toBe(`/api/makes/page?id=${ID}`);
    expect(frame.getAttribute("srcdoc")).toBeNull();
  });
  it("music_code: click frames the player route, still allow-scripts only", () => {
    const m = make({ kind: "music_code", files: { source: { ext: "js" } } });
    expect(html(m)).not.toContain("<iframe");
    render(<MakeCard make={m} source={null} now={NOW} />);
    fireEvent.click(screen.getByRole("button", { name: "play" }));
    const frame = document.querySelector("iframe")!;
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame.getAttribute("src")).toBe(`/api/makes/player?id=${ID}`);
  });
  it("the player shell loads strudel 1.1.0, reads the pattern from a JSON block it cannot escape, and has stop", () => {
    const doc = strudelShell('s("bd*4")</script><script>alert(1)');
    expect(doc).toContain('src="https://unpkg.com/@strudel/web@1.1.0"');
    expect(doc).toContain('<script type="application/json" id="code">');
    expect(doc).toContain("initStrudel({");
    expect(doc).toContain("evaluate(CODE)");
    // stop goes through the repl: evaluate() replaces the global hush() with one that leaves the clock running
    expect(doc).toContain("repl.stop()");
    expect(doc).not.toContain("hush()");
    expect(doc).toContain('id="stop"');
    expect(doc).not.toContain("alert(1)</script>");
    expect(doc).toContain("\\u003c/script\\u003e");
  });
  it("strudelShell round-trips the pattern through its JSON block", () => {
    const code = 's("bd")\n// "quoted" \u2028 </script>';
    const m = strudelShell(code).match(/id="code">(.*)<\/script>/)!;
    expect(JSON.parse(m[1])).toBe(code);
  });
});

describe("status", () => {
  it("pending: still being made, no media and no download", () => {
    const h = html(make({ status: "pending", kind: "video" }));
    expect(h).toContain("Still being made.");
    expect(h).not.toContain("<video");
    expect(h).not.toContain("download");
  });
  it("failed: didn't come out plus the reason, no download", () => {
    const h = html(make({ status: "failed", kind: "drawing", fail_reason: "bad svg", files: { source: {} } }));
    expect(h).toContain("Didn&#x27;t come out: bad svg");
    expect(h).not.toContain("download");
    expect(h).not.toContain("<img");
  });
  it("failed without a reason still reads cleanly", () => {
    expect(html(make({ status: "failed" }))).toContain("Didn&#x27;t come out.");
  });
  it("a writing whose text could not load says so", () => {
    expect(html(make({ kind: "writing", files: { source: {} } }), null)).toContain("could not be loaded");
  });
});

describe("sandbox guard", () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".next" || name === ".git" || name === ".claude") continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.(ts|tsx|js|mjs)$/.test(name) && !/\.test\./.test(name)) out.push(p);
    }
    return out;
  }
  it("no source file grants the same-origin sandbox token", () => {
    const token = ["allow", "same", "origin"].join("-");
    const hits = [...walk("app"), ...walk("lib"), ...walk("components")].filter((f) => readFileSync(f, "utf8").includes(token));
    expect(hits).toEqual([]);
  });
});
