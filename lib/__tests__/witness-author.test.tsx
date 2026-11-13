// The witness ledger is shared (2026-11-11): Gaia's page must never show another companion's row as hers,
// and the shared page must say who wrote each line.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { fetchGaiaWitness, type GaiaWitnessEntry } from "@/lib/halseth";
import { GaiaWitnessSection, witnessAuthorLabel } from "@/app/companions/[id]/sections";

const row = (id: string, author: string | null | undefined, content = id): GaiaWitnessEntry => ({
  id, session_id: "s", created_at: "2026-11-10T00:00:00Z", witness_type: "survival",
  content, seal_phrase: null, ...(author === undefined ? {} : { author }),
});

let urls: string[] = [];
let body: unknown = [];
beforeEach(() => {
  urls = [];
  vi.stubEnv("HALSETH_URL", "https://h.example");
  vi.stubGlobal("fetch", vi.fn(async (u: string) => {
    urls.push(u);
    return new Response(JSON.stringify(body), { status: 200 });
  }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("fetchGaiaWitness", () => {
  it("the shared feed asks for everything and keeps every author", async () => {
    body = [row("a", "drevan"), row("b", "gaia")];
    const rows = await fetchGaiaWitness(200);
    expect(new URL(urls[0]).searchParams.get("author")).toBeNull();
    expect(rows?.map((r) => r.id)).toEqual(["a", "b"]);
  });
  it("onlyGaia asks Halseth to filter and drops anything not hers", async () => {
    body = [row("a", "drevan"), row("b", "gaia"), row("c", null)];
    const rows = await fetchGaiaWitness(6, { onlyGaia: true });
    expect(new URL(urls[0]).searchParams.get("author")).toBe("gaia");
    expect(rows?.map((r) => r.id)).toEqual(["b"]);
  });
  it("a Worker without the field shows nothing as hers, never the whole ledger", async () => {
    body = [row("a", undefined), row("b", undefined)];
    expect(await fetchGaiaWitness(6, { onlyGaia: true })).toEqual([]);
  });
});

describe("GaiaWitnessSection", () => {
  it("labels each row with its writer", () => {
    const html = renderToStaticMarkup(
      <GaiaWitnessSection entries={[row("a", "drevan", "one"), row("b", "gaia", "two"), row("c", null, "three")]} />,
    );
    expect(html).toContain("by Drevan");
    expect(html).toContain("by Gaia");
    expect(html).toContain("by unattributed");
    expect(html).toContain("h-tone-drevan");
  });
  it("her own section shows no byline and its own empty line", () => {
    expect(renderToStaticMarkup(<GaiaWitnessSection entries={[row("b", "gaia")]} showAuthor={false} />)).not.toContain("by ");
    expect(renderToStaticMarkup(<GaiaWitnessSection entries={[]} emptyText="Nothing she has written here lately." />))
      .toContain("Nothing she has written here lately.");
  });
  it("label falls back for unknown writers", () => {
    expect(witnessAuthorLabel("cypher")).toBe("Cypher");
    expect(witnessAuthorLabel("someone")).toBe("unattributed");
    expect(witnessAuthorLabel(undefined)).toBe("unattributed");
  });
});
