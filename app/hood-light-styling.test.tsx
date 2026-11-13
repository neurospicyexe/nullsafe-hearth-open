import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

// P7 task 6: the lighter Under-the-hood pages and shared components carry no color literals,
// local companion/member color maps, left-border accents or color style values. Companion hue =
// identity (toneOf / COMPANION_COLOR), lamp = Principal or one attention state, categorical neutral.

const m = vi.hoisted(() => ({
  fetchInterCompanionNotes: vi.fn(),
  fetchGuardianFlags: vi.fn(),
  fetchSomaFeelings: vi.fn(),
  fetchPreferences: vi.fn(),
  fetchRefusals: vi.fn(),
}));
vi.mock("@/lib/halseth", () => m);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }), usePathname: () => "/" }));
vi.mock("next/link", () => ({
  default: ({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

import BetweenPage from "./between/page";
import GuardianPage from "./guardian/page";
import FeelingsPage from "./feelings/page";
import { memberToneOf } from "@/lib/tone";

const root = join(__dirname, "..");
const ALLOW = [
  "app/manifest.ts", "app/layout.tsx", "lib/app-icon.tsx", "app/library/[id]/highlight.ts",
].map((p) => p.split("/").join(sep));

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) {
      if (f === "node_modules" || f === ".next") continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(f) && !/\.test\./.test(f)) out.push(p);
  }
  return out;
}
const SOURCES = [...walk(join(root, "app")), ...walk(join(root, "components"))]
  .map((p) => relative(root, p))
  .filter((p) => !ALLOW.includes(p));

// Pre-existing generated-data and canvas-token exceptions that are not color literals in TSX.
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("no color literals outside the allowlist", () => {
  it("has no hex literals in any app/components source", () => {
    const bad = SOURCES.filter((p) => /#[0-9a-fA-F]{3,8}\b/.test(read(p).replace(/\/\/.*$/gm, "")));
    expect(bad).toEqual([]);
  });

  it("has no local companion/member color maps", () => {
    const bad = SOURCES.filter((p) => /\b(COMPANION_COLORS|MEMBER_COLOR|PRINCIPAL_COLOR|UNATTRIBUTED_COLOR|AGENT_COLORS)\b\s*[:=]/.test(read(p)));
    expect(bad).toEqual([]);
  });

  it("has no inline left-border accents or rgba/hsl literals", () => {
    const bad = SOURCES.filter((p) => {
      const src = read(p).replace(/\/\/.*$/gm, "");
      return /borderLeft/.test(src) || /style=\{\{[^}]*(rgba?|hsla?)\(/.test(src);
    });
    expect(bad).toEqual([]);
  });
});

describe("memberToneOf", () => {
  it("maps Principal to the lamp, companions to their tone, anything else neutral", () => {
    expect(memberToneOf("principal")).toBe("h-tone-principal");
    expect(memberToneOf("gaia")).toBe("h-tone-gaia");
    expect(memberToneOf("someone")).toBe("h-tone-none");
  });
});

describe("rendered light pages", () => {
  it("between: filter pills and note names use tone classes, no inline color", async () => {
    m.fetchInterCompanionNotes.mockResolvedValue([
      { id: "1", from_id: "drevan", to_id: "gaia", content: "hi", created_at: "2026-11-01T00:00:00Z" },
      { id: "2", from_id: "cypher", to_id: null, content: "all", created_at: "2026-11-01T00:00:00Z" },
    ]);
    const html = renderToStaticMarkup(await BetweenPage({ searchParams: Promise.resolve({ companion: "gaia" }) }));
    expect(html).not.toMatch(/style="[^"]*(color|border|background)/);
    expect(html).toContain("h-pill is-active h-tone-gaia");
    expect(html).toContain("icn-from h-tone-drevan");
    expect(html).toContain("icn-to h-tone-gaia");
  });

  it("guardian: severity and status use tokens through --c, warn for red/open", async () => {
    const flag = (id: string, severity: string, status: string) => ({
      id, severity, status, summary: "s", flag_type: "t", companion_id: null, created_at: "2026-11-01T00:00:00Z",
    });
    m.fetchGuardianFlags.mockImplementation(async (kind: string) =>
      kind === "live" ? [flag("a", "red", "open"), flag("b", "warning", "surfaced"), flag("c", "notice", "acknowledged")] : []);
    const html = renderToStaticMarkup(await GuardianPage());
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(html).toContain("--c:var(--h-warn)");
    expect(html).toContain("--c:var(--h-lamp)");
    expect(html).toContain("--c:var(--h-muted)");
    expect(html).not.toMatch(/style="[^"]*(?<!-)\bcolor:/);
  });

  it("feelings: companion name via tone class", async () => {
    m.fetchSomaFeelings.mockResolvedValue([
      { id: "1", companion_id: "drevan", emotion: "warm", sub_emotion: null, intensity: 3, source: null, created_at: "2026-11-01T00:00:00Z" },
    ]);
    const html = renderToStaticMarkup(await FeelingsPage());
    expect(html).toContain("h-tone-drevan");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
