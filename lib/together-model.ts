// Pure helpers for the live hints on the Together doors. No React, no fetch.
import type { Book, ClubCurrent, CreatureDetail, ToolCall } from "@/lib/halseth";
import type { Door } from "@/lib/shell";
import { ageLabel } from "@/lib/home-model";
import { imagePrompt } from "@/lib/companion-page";
import { principalVote, votable } from "@/lib/club-model";

/** One line: whitespace runs become single spaces, then cut to `max` characters with an ellipsis only when cut. */
function oneLine(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const chars = Array.from(flat);
  return chars.length > max ? chars.slice(0, max).join("") + "…" : flat;
}

/** "<age>: <text>", or just the text when the date did not parse. */
function withAge(age: string, text: string): string {
  return age ? `${age}: ${text}` : text;
}

export function clubHint(c: ClubCurrent | null): string | null {
  const round = c?.round;
  if (!c || !round) return null;
  if (votable(round)) {
    const lead = round.status === "gathering" ? "Gathering picks." : "Voting is open.";
    const canVote = c.recommendations.some((r) => r.recommended_by !== "principal");
    if (!canVote) return lead;
    return `${lead} ${principalVote(c) ? "You voted." : "You haven't voted yet."}`;
  }
  if (round.status === "active" || round.status === "discussing") {
    const win = c.recommendations.find((r) => r.id === round.winning_recommendation_id);
    if (!win) return null;
    return round.status === "active" ? `Now: ${win.title}` : `Talking about ${win.title}`;
  }
  return null;
}

export function solHint(detail: CreatureDetail | null, now: Date): string | null {
  const hit = detail?.interactions.find((i) => i.actor === "sol" && i.action === "appear" && (i.note ?? "").trim() !== "");
  if (!hit) return null;
  return withAge(ageLabel(hit.created_at, now), oneLine(hit.note ?? "", 80));
}

export function readingHint(book: Book | null): string | null {
  if (!book) return null;
  return `${book.title} · ${Math.round(book.progress_percent ?? 0)}%`;
}

export function galleryHint(img: ToolCall | null, now: Date): string | null {
  if (!img) return null;
  const prompt = imagePrompt(img.args_summary);
  if (prompt === "(untitled)") return null;
  return withAge(ageLabel(img.created_at, now), oneLine(prompt, 60));
}

/** Doors with their hints attached, keyed by href. A null or missing hint leaves the door as it was. */
export function togetherDoors(doors: Door[], hints: Partial<Record<string, string | null>>): Door[] {
  return doors.map((d) => {
    const hint = hints[d.href];
    return hint ? { ...d, hint } : { ...d };
  });
}
