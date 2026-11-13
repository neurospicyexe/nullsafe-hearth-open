import { NextRequest, NextResponse } from "next/server";
import {
  fetchAllDeltas,
  fetchCompanionJournal,
  fetchDreamsOrNull,
  fetchHandovers,
  fetchTasksOrNull,
  fetchWounds,
  fetchLettersOut,
  fetchMindHandoffsOrNull,
  fetchInterCompanionNotesOrNull,
  type RelationalDelta,
  type CompanionJournalEntry,
  type Dream,
  type HandoverPacket,
  type Task,
  type LivingWound,
  type Note,
  type MindHandoff,
  type InterCompanionNote,
} from "@/lib/halseth";
import { isLetterRow } from "@/lib/journal-model";
import { HALSETH_DOWN } from "@/lib/archive-copy";

type SearchType = "all" | "feelings" | "journal" | "dreams" | "handovers" | "tasks" | "notes" | "wounds";

type SearchResult = {
  id: string;
  type: "feeling" | "journal" | "dream" | "handover" | "task" | "note" | "wound";
  text: string;
  created_at: string;
  url: string;
  agent?: string;
};

type SearchResponse = {
  feelings: SearchResult[];
  journal: SearchResult[];
  dreams: SearchResult[];
  handovers: SearchResult[];
  tasks: SearchResult[];
  notes: SearchResult[];
  wounds: SearchResult[];
};

function matches(text: string | null | undefined, q: string): boolean {
  return typeof text === "string" && text.toLowerCase().includes(q.toLowerCase());
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });
  if (q.length > 100) return NextResponse.json({ error: "q too long" }, { status: 400 });

  const rawType = searchParams.get("type") ?? "all";
  const type: SearchType = ["all", "feelings", "journal", "dreams", "handovers", "tasks", "notes", "wounds"].includes(rawType)
    ? (rawType as SearchType)
    : "all";

  const want = (t: Exclude<SearchType, "all">) => type === "all" || type === t;

  try {
    const [rawFeelings, rawJournal, rawDreams, rawHandovers, rawMindHandoffs, rawTasks, rawWounds, rawLetters, rawInterNotes] = await Promise.all([
      want("feelings")  ? fetchAllDeltas(50)               : Promise.resolve(null),
      want("journal")   ? fetchCompanionJournal(undefined, 50) : Promise.resolve(null),
      want("dreams")    ? fetchDreamsOrNull(undefined, 50)        : Promise.resolve(null),
      want("handovers") ? fetchHandovers(50)                : Promise.resolve(null),
      want("handovers") ? fetchMindHandoffsOrNull(50)             : Promise.resolve(null),
      want("tasks")     ? fetchTasksOrNull()                : Promise.resolve(null),
      want("wounds")    ? fetchWounds()                     : Promise.resolve(null),
      want("notes")     ? fetchLettersOut(100)              : Promise.resolve(null),
      want("notes")     ? fetchInterCompanionNotesOrNull(50)      : Promise.resolve(null),
    ]);

    // A source we did not ask for is null too, so only requested sources count. If every one of
    // them came back null, Halseth is down: say so rather than answering "no results".
    const requested = [
      [want("feelings"), rawFeelings], [want("journal"), rawJournal], [want("dreams"), rawDreams],
      [want("handovers"), rawHandovers], [want("handovers"), rawMindHandoffs], [want("tasks"), rawTasks],
      [want("wounds"), rawWounds], [want("notes"), rawLetters], [want("notes"), rawInterNotes],
    ].filter(([asked]) => asked);
    if (requested.every(([, raw]) => raw === null)) {
      return NextResponse.json({ error: HALSETH_DOWN }, { status: 503 });
    }

    const feelings: SearchResult[] = (rawFeelings ?? [])
      .filter((d: RelationalDelta) => matches(d.delta_text, q))
      .map((d: RelationalDelta) => ({
        id: d.id, type: "feeling" as const, text: d.delta_text ?? "", created_at: d.created_at, url: "/feelings",
      }));

    const journal: SearchResult[] = (rawJournal ?? [])
      .filter((e: CompanionJournalEntry) => matches(e.note_text, q))
      .map((e: CompanionJournalEntry) => ({
        id: e.id, type: "journal" as const, text: e.note_text, created_at: e.created_at,
        url: isLetterRow(e.tags, e.review_state) ? `/letters/${e.id}` : `/companions/${e.agent}`, agent: e.agent,
      }));

    const dreams: SearchResult[] = (rawDreams ?? [])
      .filter((d: Dream) => matches(d.content, q))
      .map((d: Dream) => ({
        id: d.id, type: "dream" as const, text: d.content, created_at: d.generated_at, url: "/dreams",
      }));

    const handovers: SearchResult[] = [
      ...(rawHandovers ?? [])
        .filter((h: HandoverPacket) => matches(h.spine, q) || matches(h.last_real_thing, q))
        .map((h: HandoverPacket) => ({
          id: h.id, type: "handover" as const, text: h.spine, created_at: h.created_at, url: "/sessions",
        })),
      ...(rawMindHandoffs ?? [])
        .filter((h: MindHandoff) => matches(h.title, q) || matches(h.summary, q) || matches(h.next_steps, q))
        .map((h: MindHandoff) => ({
          id: h.id, type: "handover" as const,
          text: [h.title, h.summary].filter(Boolean).join(": "),
          created_at: h.created_at, url: "/sessions", agent: h.agent_id,
        })),
    ];

    const tasks: SearchResult[] = (rawTasks ?? [])
      .filter((t: Task) => matches(t.title, q))
      .map((t: Task) => ({
        id: t.id, type: "task" as const, text: t.title, created_at: t.due_at ?? "", url: "/tasks",
      }));
      
    const wounds: SearchResult[] = (rawWounds ?? [])
      .filter((w: LivingWound) => matches(w.name, q) || matches(w.description, q))
      .map((w: LivingWound) => ({
        id: w.id, type: "wound" as const, text: w.name ?? "", created_at: w.created_at, url: "/us",
      }));
      
    const notes: SearchResult[] = [
      ...(rawLetters ?? [])
        .filter((n: Note) => matches(n.content, q))
        .map((n: Note) => {
          const agent = n.note_type.slice("letter:".length);
          return {
            id: n.id, type: "note" as const, text: n.content, created_at: n.created_at,
            url: `/letters?with=${agent}`, agent,
          };
        }),
      ...(rawInterNotes ?? [])
        .filter((n: InterCompanionNote) => matches(n.content, q))
        .map((n: InterCompanionNote) => ({
          id: n.id, type: "note" as const, text: n.content, created_at: n.created_at,
          url: "/us", agent: n.from_id,
        })),
    ];

    const result: SearchResponse = { feelings, journal, dreams, handovers, tasks, wounds, notes };
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Search unavailable" }, { status: 500 });
  }
}
