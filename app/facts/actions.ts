"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/require-session";
import {
  fetchArchitectFacts,
  patchArchitectFactStatus,
  postArchitectFact,
} from "@/lib/halseth";

// D1 timestamps are "YYYY-MM-DD HH:MM:SS" UTC, no zone marker — append one so Date parses it
// as UTC instead of local time (Node/browser default for a space-separated, zoneless string
// is inconsistent; the "T..Z" ISO form is not).
function ageDays(createdAt: string): number {
  const ms = Date.now() - new Date(createdAt.replace(" ", "T") + "Z").getTime();
  return ms / 86_400_000;
}

export type ActionResult = { ok: boolean; message: string };

export async function confirmFact(id: string): Promise<ActionResult> {
  if (await requireSession()) return { ok: false, message: "unauthorized" };
  const r = await patchArchitectFactStatus(id, "active");
  revalidatePath("/facts");
  return r?.ok
    ? { ok: true, message: "confirmed" }
    : { ok: false, message: "confirm failed — Halseth did not accept the change" };
}

export async function retireFact(id: string): Promise<ActionResult> {
  if (await requireSession()) return { ok: false, message: "unauthorized" };
  const r = await patchArchitectFactStatus(id, "retired");
  revalidatePath("/facts");
  return r?.ok
    ? { ok: true, message: "retired" }
    : { ok: false, message: "retire failed — Halseth did not accept the change" };
}

// "Fix" = supersede: post a corrected fact naming the old row as supersedes_id. Halseth
// retires the old row atomically as part of the same write (see postArchitectFact handler).
export async function fixFact(
  supersedesId: string,
  factText: string,
  category: string,
): Promise<ActionResult> {
  if (await requireSession()) return { ok: false, message: "unauthorized" };
  const fact = factText.trim();
  if (!fact) return { ok: false, message: "fact text can't be empty" };
  const r = await postArchitectFact({
    fact,
    category,
    status: "active",
    source: "principal",
    supersedes_id: supersedesId,
  });
  revalidatePath("/facts");
  // Halseth's novelty gate runs before the supersede and can match the very row being fixed
  // (a typo fix is near-identical): it answers {ok:true, deduped:true}, writes nothing and retires
  // nothing. Reporting that as "superseded" hid it; say what actually happened.
  if (r?.deduped) {
    return { ok: false, message: "not changed: Halseth read this as a duplicate of an existing fact (likely the one you are fixing)" };
  }
  return r?.ok
    ? { ok: true, message: "superseded" }
    : { ok: false, message: "fix failed — Halseth did not accept the new fact" };
}

// Sequential by design: PATCHes one at a time so a mid-run failure (network blip, a row that
// changed status between the read and the write) reports an accurate partial count instead of
// an all-or-nothing failure that hides how many actually landed.
export async function retireOlderThan30Days(): Promise<ActionResult> {
  if (await requireSession()) return { ok: false, message: "unauthorized" };
  const facts = await fetchArchitectFacts();
  const stale = facts.filter((f) => f.status === "open" && ageDays(f.created_at) > 30);

  let retired = 0;
  for (const f of stale) {
    const r = await patchArchitectFactStatus(f.id, "retired");
    if (r?.ok) retired += 1;
  }
  revalidatePath("/facts");

  if (stale.length === 0) return { ok: true, message: "nothing older than 30 days" };
  return retired === stale.length
    ? { ok: true, message: `retired ${retired} fact${retired === 1 ? "" : "s"}` }
    : { ok: false, message: `retired ${retired} of ${stale.length} — some failed` };
}
