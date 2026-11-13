import { describe, it, expect } from "vitest";
import {
  COMPANION_IDS,
  COMPANION_NAME,
  parseCompanionId,
  doorGroups,
  companionDoors,
  groupForSlug,
  rundownLines,
  traceValid,
  companionBars,
  subnavFor,
  imagePrompt,
  groupProjects,
  companionPills,
  mindDoors,
  recordsRow,
} from "../companion-page";
import type { CompanionId, CompanionRundown, CompanionSomaState, Project } from "../halseth";

function rundown(over: Partial<CompanionRundown> = {}): CompanionRundown {
  return {
    companion_id: "cypher",
    last_real_thing: null,
    last_looked_at: "2026-10-30 10:00:00",
    since_basis: "last_looked",
    since: { journal: 0, letters: 0, book_notes: 0, sol: 0, autonomy: 0 },
    doors: { journal: 1, letters_unread: 2, growth: 3, feelings: 4, upto: 5, made: 6 },
    trace: { soma_float_1: [], soma_float_2: [], soma_float_3: [] },
    ...over,
  };
}

const BASE_SLUGS = [
  "journal", "notes", "sitting", "letters", "growth", "worldview", "loops", "blocks",
  "feelings", "relational", "deltas", "autonomy", "projects", "thinking", "made", "all",
];

describe("parseCompanionId", () => {
  it("lowercases a member", () => {
    expect(parseCompanionId("Cypher")).toBe("cypher");
    expect(parseCompanionId("drevan")).toBe("drevan");
    expect(parseCompanionId("GAIA")).toBe("gaia");
  });
  it("rejects anything else", () => {
    for (const raw of ["spouse", "", "__proto__", "constructor", "cypher "]) {
      expect(parseCompanionId(raw), raw).toBeNull();
    }
  });
  it("names every id", () => {
    expect(COMPANION_IDS).toEqual(["drevan", "cypher", "gaia"]);
    expect(COMPANION_NAME).toEqual({ drevan: "Drevan", cypher: "Cypher", gaia: "Gaia" });
  });
});

describe("doorGroups", () => {
  const slugs = (id: CompanionId) => doorGroups(id).flatMap((g) => g.routes.map((r) => r.slug));

  it("gives Gaia witness, Cypher audit, Drevan neither", () => {
    expect(slugs("gaia")).toContain("witness");
    expect(slugs("gaia")).not.toContain("audit");
    expect(slugs("cypher")).toContain("audit");
    expect(slugs("cypher")).not.toContain("witness");
    expect(slugs("drevan")).not.toContain("audit");
    expect(slugs("drevan")).not.toContain("witness");
  });

  it("keeps every old sub-route reachable (exact union per companion)", () => {
    const extra: Record<CompanionId, string[]> = { drevan: [], cypher: ["audit"], gaia: ["witness"] };
    for (const id of COMPANION_IDS) {
      expect([...slugs(id)].sort(), id).toEqual([...BASE_SLUGS, ...extra[id]].sort());
    }
  });

  it("uses the labels and order of the table", () => {
    expect(doorGroups("drevan").map((g) => [g.key, g.label])).toEqual([
      ["journal", "Journal"],
      ["letters", "Letters"],
      ["growth", "Growth"],
      ["feelings", "Feelings"],
      ["upto", "What I've been up to"],
      ["thinking", "Thinking"],
      ["made", "Made"],
      ["all", "Everything else"],
    ]);
    const growth = doorGroups("cypher").find((g) => g.key === "growth")!;
    expect(growth.routes).toEqual([
      { slug: "growth", label: "Growth" },
      { slug: "worldview", label: "Worldview" },
      { slug: "loops", label: "Open loops" },
      { slug: "blocks", label: "Blocks" },
      { slug: "audit", label: "Audit" },
    ]);
    const journal = doorGroups("gaia").find((g) => g.key === "journal")!;
    expect(journal.routes.map((r) => r.label)).toEqual(["Journal", "Notes", "Sitting with", "Witness"]);
    const upto = doorGroups("gaia").find((g) => g.key === "upto")!;
    expect(upto.routes).toEqual([
      { slug: "autonomy", label: "Autonomous runs" },
      { slug: "projects", label: "Projects" },
    ]);
  });
});

describe("companionDoors", () => {
  it("returns the seven doors with counts mapped", () => {
    expect(companionDoors("gaia", rundown())).toEqual([
      { href: "/companions/gaia/journal", label: "Journal", count: 1 },
      { href: "/companions/gaia/letters", label: "Letters", count: 2 },
      { href: "/companions/gaia/growth", label: "Growth", count: 3 },
      { href: "/companions/gaia/feelings", label: "Feelings", count: 4 },
      { href: "/companions/gaia/autonomy", label: "What I've been up to", count: 5 },
      { href: "/companions/gaia/thinking", label: "Thinking" },
      { href: "/companions/gaia/made", label: "Made", count: 6 },
    ]);
  });
  it("has no count keys when the rundown is null", () => {
    const doors = companionDoors("drevan", null);
    expect(doors).toHaveLength(7);
    for (const d of doors) expect("count" in d, d.href).toBe(false);
  });
});

describe("groupForSlug", () => {
  it("finds the group holding a slug", () => {
    expect(groupForSlug("cypher", "worldview")?.key).toBe("growth");
    expect(groupForSlug("gaia", "witness")?.key).toBe("journal");
    expect(groupForSlug("drevan", "projects")?.key).toBe("upto");
    expect(groupForSlug("drevan", "all")?.key).toBe("all");
  });
  it("is null for the overview, unknown slugs, and another companion's extra", () => {
    expect(groupForSlug("cypher", "")).toBeNull();
    expect(groupForSlug("cypher", "nope")).toBeNull();
    expect(groupForSlug("drevan", "audit")).toBeNull();
    expect(groupForSlug("cypher", "witness")).toBeNull();
  });
});

describe("rundownLines", () => {
  const now = Date.parse("2026-10-30T12:00:00Z");

  it("says This week on a first visit", () => {
    const r = rundown({ since_basis: "week", last_looked_at: null, since: { journal: 2, letters: 0, book_notes: 0, sol: 0, autonomy: 0 } });
    expect(rundownLines(r, now)).toEqual({ heading: "This week", lines: ["2 journal entries"] });
  });

  it("says since you last looked with the age", () => {
    const r = rundown({ since: { journal: 1, letters: 1, book_notes: 1, sol: 1, autonomy: 1 } });
    expect(rundownLines(r, now)).toEqual({
      heading: "Since you last looked (2h)",
      lines: ["1 journal entry", "1 letter", "1 book note", "1 Sol visit", "1 autonomous run"],
    });
  });

  it("pluralises and skips zeros, in order", () => {
    const r = rundown({ since: { journal: 0, letters: 3, book_notes: 2, sol: 2, autonomy: 4 } });
    expect(rundownLines(r, now).lines).toEqual(["3 letters", "2 book notes", "2 Sol visits", "4 autonomous runs"]);
  });

  it("says Nothing new when everything is zero", () => {
    expect(rundownLines(rundown(), now).lines).toEqual(["Nothing new."]);
  });
});

describe("traceValid", () => {
  it("needs exactly 7 numbers", () => {
    expect(traceValid([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7])).toBe(true);
    expect(traceValid([0.1, 0.2, null, 0.4, 0.5, 0.6, 0.7])).toBe(false);
    expect(traceValid([0.1, 0.2, 0.3, 0.4, 0.5, 0.6])).toBe(false);
    expect(traceValid([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8])).toBe(false);
    expect(traceValid([])).toBe(false);
  });
});

describe("companionBars", () => {
  const soma: CompanionSomaState = {
    companion_id: "cypher",
    soma_float_1: 0.42, soma_float_2: null, soma_float_3: 0.9,
    float_1_label: "focus", float_2_label: "warmth", float_3_label: null,
    compound_state: null, current_mood: null, surface_emotion: null, surface_intensity: null,
    undercurrent_emotion: null, undercurrent_intensity: null, heat: null, reach: null, weight: null,
    mood_set_at: null, seen_at: null, updated_at: "2026-10-30 10:00:00",
  };
  const seven = (v: number) => [v, v, v, v, v, v, v];

  it("maps floats like Home (null float dropped, label fallback) without a rundown", () => {
    expect(companionBars(soma, null)).toEqual([
      { label: "focus", pct: 42 },
      { label: "float 3", pct: 90 },
    ]);
  });

  it("attaches each trace to its own float key, not by position", () => {
    const r = rundown({ trace: { soma_float_1: seven(0.1), soma_float_2: seven(0.2), soma_float_3: seven(0.3) } });
    expect(companionBars(soma, r)).toEqual([
      { label: "focus", pct: 42, trace: seven(0.1) },
      { label: "float 3", pct: 90, trace: seven(0.3) },
    ]);
  });

  it("leaves out a trace with a gap", () => {
    const r = rundown({ trace: { soma_float_1: [0.1, null, 0.1, 0.1, 0.1, 0.1, 0.1], soma_float_2: [], soma_float_3: seven(0.3) } });
    expect(companionBars(soma, r)[0]).toEqual({ label: "focus", pct: 42 });
  });

  it("is empty with no soma row", () => {
    expect(companionBars(null, rundown())).toEqual([]);
  });
});

describe("subnavFor", () => {
  it("is null on the overview", () => {
    expect(subnavFor("cypher", "/companions/cypher")).toBeNull();
    expect(subnavFor("cypher", "/companions/Cypher/")).toBeNull();
  });

  it("shows the back link and the group's siblings, current marked", () => {
    expect(subnavFor("cypher", "/companions/cypher/worldview")).toEqual({
      back: { href: "/companions/cypher", label: "Cypher" },
      links: [
        { href: "/companions/cypher/growth", label: "Growth", current: false },
        { href: "/companions/cypher/worldview", label: "Worldview", current: true },
        { href: "/companions/cypher/loops", label: "Open loops", current: false },
        { href: "/companions/cypher/blocks", label: "Blocks", current: false },
        { href: "/companions/cypher/audit", label: "Audit", current: false },
      ],
    });
  });

  it("lowercases the slug too, so /Journal still finds its group and marks current", () => {
    const nav = subnavFor("cypher", "/companions/cypher/Journal");
    expect(nav?.links.find((l) => l.current)?.href).toBe("/companions/cypher/journal");
  });

  it("uses the lowercased id even when the URL is not", () => {
    expect(subnavFor("gaia", "/companions/GAIA/witness")?.links.map((l) => l.href)).toContain("/companions/gaia/witness");
  });

  it("shows only the back link on /all, single-route groups and unknown slugs", () => {
    for (const p of ["/companions/drevan/all", "/companions/drevan/letters", "/companions/drevan/made", "/companions/drevan/nope"]) {
      expect(subnavFor("drevan", p), p).toEqual({ back: { href: "/companions/drevan", label: "Drevan" }, links: [] });
    }
  });
});

describe("imagePrompt", () => {
  it("strips the stored prompt: prefix like /gallery", () => {
    expect(imagePrompt("prompt: a lantern")).toBe("a lantern");
    expect(imagePrompt("Prompt:   moss")).toBe("moss");
    expect(imagePrompt("prompt:   ")).toBe("(untitled)");
  });
});

describe("groupProjects", () => {
  const p = (id: string, status: Project["status"]): Project => ({
    id, companion_id: "gaia", title: id, intention: "", status,
    horizon_note: null, resolution_note: null, created_at: "2026-10-01 00:00:00", last_worked_at: null, closed_at: null,
  });

  it("groups Open, Paused, Done and released in that order, keeping row order, dropping empty groups", () => {
    const groups = groupProjects([p("a", "done"), p("b", "open"), p("c", "released"), p("d", "open")]);
    expect(groups.map((g) => [g.heading, g.projects.map((x) => x.id)])).toEqual([
      ["Open", ["b", "d"]],
      ["Done and released", ["a", "c"]],
    ]);
  });

  it("is empty for no projects", () => {
    expect(groupProjects([])).toEqual([]);
  });
});

describe("companionPills", () => {
  const cur = (path: string) => companionPills("drevan", path).filter((p) => p.current).map((p) => p.label);
  it("are Now, Mind, Letters, Made, Thinking, pointing at the companion's routes", () => {
    expect(companionPills("gaia", "/companions/gaia").map((p) => [p.label, p.href])).toEqual([
      ["Now", "/companions/gaia"],
      ["Mind", "/companions/gaia/mind"],
      ["Letters", "/companions/gaia/letters"],
      ["Made", "/companions/gaia/made"],
      ["Garden", "/companions/gaia/garden"],
      ["Thinking", "/companions/gaia/thinking"],
    ]);
  });
  it("carries Garden for Gaia only, and marks it on her garden page", () => {
    expect(companionPills("drevan", "/companions/drevan").map((p) => p.label)).not.toContain("Garden");
    expect(companionPills("cypher", "/companions/cypher").map((p) => p.label)).not.toContain("Garden");
    const on = companionPills("gaia", "/companions/gaia/garden").filter((p) => p.current).map((p) => p.label);
    expect(on).toEqual(["Garden"]);
  });
  it("marks Now on the overview, whatever the case or trailing slash", () => {
    expect(cur("/companions/drevan")).toEqual(["Now"]);
    expect(cur("/companions/Drevan/")).toEqual(["Now"]);
  });
  it("marks Letters, Made and Thinking (including a thinking detail page)", () => {
    expect(cur("/companions/drevan/letters")).toEqual(["Letters"]);
    expect(cur("/companions/drevan/made")).toEqual(["Made"]);
    expect(cur("/companions/drevan/thinking")).toEqual(["Thinking"]);
    expect(cur("/companions/drevan/thinking/abc")).toEqual(["Thinking"]);
  });
  it("marks Mind for the mind page and every journal, growth, feelings and upto route plus /all", () => {
    for (const slug of ["mind", "journal", "notes", "sitting", "growth", "worldview", "loops", "blocks", "feelings", "relational", "deltas", "autonomy", "projects", "all"]) {
      expect(cur(`/companions/drevan/${slug}`), slug).toEqual(["Mind"]);
    }
  });
  it("marks nothing for a slug this companion lacks", () => {
    expect(cur("/companions/drevan/nope")).toEqual([]);
  });
});

describe("mindDoors", () => {
  it("covers every sub-route that is not a pill, so nothing is orphaned", () => {
    const reach = new Set(mindDoors("cypher", null).map((d) => d.href));
    for (const g of doorGroups("cypher")) {
      if (["letters", "made", "thinking"].includes(g.key)) continue;
      expect(reach.has(`/companions/cypher/${g.routes[0].slug}`), g.key).toBe(true);
    }
    expect(reach.has("/companions/cypher/sitting")).toBe(true);
    expect(reach.has("/companions/cypher/all")).toBe(true);
    expect(reach.has("/soma")).toBe(true);
  });
  it("carries the rundown counts on journal, growth, feelings and upto", () => {
    const doors = mindDoors("gaia", rundown());
    expect(doors.find((d) => d.href === "/companions/gaia/journal")?.count).toBe(1);
    expect(doors.find((d) => d.href === "/companions/gaia/growth")?.count).toBe(3);
  });
});

describe("recordsRow", () => {
  it("names the companion and links the record pages (unscoped: they take no companion filter)", () => {
    const r = recordsRow("drevan");
    expect(r.label).toBe("Drevan's records");
    expect(r.links.map((l) => [l.label, l.href])).toEqual([
      ["drift", "/drifts"],
      ["orient", "/orient"],
      ["facts", "/facts"],
    ]);
  });
});
