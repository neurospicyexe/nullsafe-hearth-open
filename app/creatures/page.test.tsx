// The Creatures page's honesty about Halseth: unreachable is said, never shown as an empty list.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Creature, CreatureDetail } from "@/lib/halseth";

let creatures: Creature[] | null = null;
let detail: CreatureDetail | null = null;
vi.mock("@/lib/halseth", async (orig) => ({
  ...(await orig<typeof import("@/lib/halseth")>()),
  fetchCreaturesOrNull: async () => creatures,
  fetchCreature: async () => detail,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }), usePathname: () => "/creatures" }));
vi.mock("@/components/shell/WriteQueueProvider", () => ({ useWriteQueue: () => ({ submit: vi.fn(), flush: vi.fn() }) }));

import CreaturesPage from "./page";

const sol = { id: "sol", name: "Sol", kind: "companion_pet", trust: 0.5 } as unknown as Creature;

beforeEach(() => {
  creatures = null;
  detail = null;
});

describe("CreaturesPage", () => {
  it("Halseth down reads Can't reach Halseth right now., not No creatures yet.", async () => {
    const html = renderToStaticMarkup(await CreaturesPage());
    expect(html).toContain("Can&#x27;t reach Halseth right now.");
    expect(html).not.toContain("No creatures yet.");
  });

  it("a successful read with none says No creatures yet.", async () => {
    creatures = [];
    const html = renderToStaticMarkup(await CreaturesPage());
    expect(html).toContain("No creatures yet.");
  });

  it("a failed detail read is said on the card, not shown as none yet", async () => {
    creatures = [sol];
    const html = renderToStaticMarkup(await CreaturesPage());
    expect(html).toContain("Couldn&#x27;t load the rest of this card from Halseth.");
    expect(html).not.toContain("none yet");
    expect(html).toContain("feed");
  });

  it("a failed detail read still shows when he was last tended, from the list read", async () => {
    creatures = [{ ...sol, last_interaction_at: "2026-10-30T12:00:00Z" } as Creature];
    const html = renderToStaticMarkup(await CreaturesPage());
    expect(html).toContain("Couldn&#x27;t load the rest of this card from Halseth.");
    expect(html).toContain("Last tended");
  });

  it("Sol's appear moment and his note render as written", async () => {
    creatures = [sol];
    detail = {
      creature: sol,
      interactions: [{ id: "i1", creature_id: "sol", actor: "sol", action: "appear", note: "brought you a bottle cap", created_at: "2026-10-30T00:00:00Z" }],
    } as unknown as CreatureDetail;
    const html = renderToStaticMarkup(await CreaturesPage());
    expect(html).toContain("appeared");
    expect(html).toContain("brought you a bottle cap");
    expect(html).toContain("is-sol");
  });

  describe("Sol's mind (B64)", () => {
    const mind = (extra: Record<string, unknown>) =>
      ({ creature: sol, interactions: [], ...extra }) as unknown as CreatureDetail;

    it("shows forming traits (readable, top 5, 5 dots), quirks, the grudge, and his history", async () => {
      creatures = [sol];
      detail = mind({
        traits_forming: [
          { slug: "wary-of-hands", category: "habit", entrenchment: 3 },
          { slug: "dawn_feeder", category: null, entrenchment: 1 },
          { slug: "t3", category: null, entrenchment: 0 },
          { slug: "t4", category: null, entrenchment: 0 },
          { slug: "t5", category: null, entrenchment: 0 },
          { slug: "sixth-one", category: null, entrenchment: 0 },
        ],
        quirks: [
          { title: "Being Poked", behavior: "flinches and sulks", status: "active" },
          { title: "Dawn Feeds", behavior: "eats fast", status: "softening" },
        ],
        quirks_retired: [{ title: "Old Habit", behavior: "sulked at the lamp" }],
        grudge: { actor: "principal", label: "still sore about being poked", progress: 1, of: 2 },
        grudges: [],
      });
      const html = renderToStaticMarkup(await CreaturesPage());
      expect(html).toContain("Forming");
      expect(html).toContain("wary of hands");
      expect(html).toContain("dawn feeder");
      expect(html).not.toContain("sixth one");
      expect(html).toContain("●●●○○"); // entrenchment 3 of 5
      expect(html).toContain("Quirks");
      expect(html).toContain("Being Poked");
      expect(html).toContain("flinches and sulks");
      expect(html).toContain("softening");
      expect(html).toContain("Right now");
      expect(html).toContain("still sore about being poked");
      expect(html).toContain("1 of 2");
      expect(html).toContain("<details");
      expect(html).toContain("his history");
      expect(html).toContain("Old Habit");
      expect(html).toContain("sulked at the lamp");
    });

    it("R29: lists every open grudge, each with who it is with and the unit", async () => {
      creatures = [sol];
      const a = { actor: "cypher", label: "still sore about dawn feeds", progress: 1, of: 2, unit: "visits" };
      const b = { actor: "drevan", label: "still sore about being poked", progress: 5, of: 12, unit: "hours" };
      detail = mind({ grudge: a, grudges: [a, b] });
      const html = renderToStaticMarkup(await CreaturesPage());
      expect(html).toContain("still sore about dawn feeds, with Cypher (1 of 2 visits)");
      expect(html).toContain("still sore about being poked, with Drevan (5 of 12 hours)");
    });

    it("an older Halseth response without the fields renders the card as before", async () => {
      creatures = [sol];
      detail = mind({});
      const html = renderToStaticMarkup(await CreaturesPage());
      expect(html).toContain("recent activity");
      expect(html).not.toContain("Forming");
      expect(html).not.toContain("Right now");
      expect(html).not.toContain("his history");
    });

    it("empty arrays and a null grudge render without sections or a crash", async () => {
      creatures = [sol];
      detail = mind({ traits_forming: [], quirks: [], quirks_retired: [], grudge: null, grudges: [] });
      const html = renderToStaticMarkup(await CreaturesPage());
      expect(html).toContain("recent activity");
      expect(html).not.toContain("Right now");
      expect(html).not.toContain("his history");
    });

    it("other creatures never show Sol's mind sections", async () => {
      const pip = { id: "pet", name: "Pip", kind: "real_animal", trust: 0.5 } as unknown as Creature;
      creatures = [pip];
      detail = mind({ creature: pip, traits_forming: [{ slug: "x-y", category: null, entrenchment: 2 }], quirks: [{ title: "Q", behavior: "b", status: "active" }] });
      const html = renderToStaticMarkup(await CreaturesPage());
      expect(html).not.toContain("Forming");
      expect(html).not.toContain("Quirks");
    });
  });
});
