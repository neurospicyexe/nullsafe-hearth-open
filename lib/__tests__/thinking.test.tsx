import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { thinkingLine } from "../thinking";
import ThinkingStrip from "@/components/home/ThinkingStrip";
import type { ThinkingItem } from "../halseth";

const item = (over: Partial<ThinkingItem> = {}): ThinkingItem => ({
  id: "t1",
  companion_id: "drevan",
  source: "interest",
  kind: "made",
  subject: "moss",
  why: "it was quiet",
  why_private: false,
  interest_id: "int1",
  created_at: "2026-11-03T12:00:00Z",
  ...over,
});

describe("made line (B7)", () => {
  it("points a made line at the maker's Made shelf", () => {
    expect(thinkingLine(item())?.madeHref).toBe("/companions/drevan/made");
    expect(thinkingLine(item({ companion_id: "gaia" }))?.madeHref).toBe("/companions/gaia/made");
  });
  it("leaves every other kind without a made link", () => {
    expect(thinkingLine(item({ kind: "born" }))?.madeHref).toBeNull();
    expect(thinkingLine(item({ kind: "cooled" }))?.madeHref).toBeNull();
  });
  it("links 'made something' to the shelf and the subject to its interest", () => {
    const line = thinkingLine(item())!;
    const html = renderToStaticMarkup(<ThinkingStrip lines={[line]} now={new Date("2026-11-03T13:00:00Z")} />);
    expect(html).toMatch(/href="\/companions\/drevan\/made"[^>]*>made something<\/a> for/);
    expect(html).toMatch(/href="\/companions\/drevan\/thinking\/int1"[^>]*>moss</);
  });
  it("still renders a made line with no interest (no subject link, shelf link kept)", () => {
    const line = thinkingLine(item({ interest_id: null }))!;
    const html = renderToStaticMarkup(<ThinkingStrip lines={[line]} now={new Date("2026-11-03T13:00:00Z")} />);
    expect(html).toContain('href="/companions/drevan/made"');
    expect(html).not.toContain("/thinking/");
  });
});
