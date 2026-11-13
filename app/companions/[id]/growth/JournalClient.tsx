"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GrowthJournalEntry } from "@/lib/halseth";
import { fmtTime } from "../sections";
import { entryTypeColor, sourceColor, reviewStatusColor } from "../domain-colors";

function tone(color: string): React.CSSProperties {
  return { "--c": color } as React.CSSProperties;
}

function ReviewBadge({ status }: { status?: "pending" | "accepted" | "declined" }) {
  if (!status || status === "pending") return null;
  return <span className="h-cmp-badge" style={tone(reviewStatusColor(status))}>{status}</span>;
}

interface Props {
  entries: GrowthJournalEntry[];
  companionId: string;
  /** Shown when there is nothing to list. In the queue view "nothing left to ratify" is a win, not a void. */
  emptyText?: string;
}

export default function JournalClient({ entries, companionId, emptyText }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [localStatus, setLocalStatus] = useState<Record<string, "pending" | "accepted" | "declined">>({});
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleAction(id: string, action: "accept" | "decline") {
    setBusy((p) => ({ ...p, [id]: true }));
    setActionError(null);
    try {
      // companion_id is REQUIRED (2026-07-27). Halseth's acceptJournalEntry /
      // declineJournalEntry run validateCompanion(body.companion_id) and 400 without it, and
      // setReviewStatus scopes its UPDATE by companion_id as an ownership guard. This call
      // sent no body at all, so every ratification from Hearth failed with "Action failed --
      // try again". It had never worked: the queue was three levels deep with no count, so
      // nobody reached the button, so nobody found it broken. `companionId` was already a
      // prop on this component the whole time.
      const res = await fetch(`/api/mind/growth/journal/${id}/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companion_id: companionId }),
      });
      if (res.ok) {
        setLocalStatus((p) => ({ ...p, [id]: action === "accept" ? "accepted" : "declined" }));
        router.refresh();
      } else {
        // Surface WHY. A bare "try again" on a deterministic 400 sends Principal in circles.
        let detail = `${res.status}`;
        try {
          const j = await res.json() as { error?: string };
          if (j?.error) detail = `${res.status} ${j.error}`;
        } catch { /* non-JSON body -- status alone is still better than nothing */ }
        setActionError(`Could not ${action} that entry (${detail})`);
      }
    } catch {
      setActionError("Network error");
    } finally {
      setBusy((p) => ({ ...p, [id]: false }));
    }
  }

  if (entries.length === 0) {
    return <p className="h-empty">{emptyText ?? "No journal entries yet"}</p>;
  }

  return (
    <>
      {actionError && (
        <p className="h-cmp-err">{actionError}</p>
      )}
      <div className="section-list">
        {entries.map((entry) => {
          const typeBadgeColor = entryTypeColor(entry.entry_type);
          const sourceBadgeColor = sourceColor(entry.source);

          let tags: string[] = [];
          try {
            const parsed = JSON.parse(entry.tags_json);
            tags = Array.isArray(parsed) ? parsed : [];
          } catch { tags = []; }

          const status = localStatus[entry.id] ?? entry.review_status;
          const isPending = !status || status === "pending";
          const isBusy = busy[entry.id] ?? false;

          return (
            <div key={entry.id} className="section-row h-cmp-col">
              {/* Badges row: review state is carried by its badge, not an edge accent */}
              <div className="h-cmp-wrap">
                <span className="h-cmp-badge" style={tone(typeBadgeColor)}>
                  {entry.entry_type}
                </span>
                {entry.source && sourceBadgeColor && (
                  <span className="h-cmp-badge" style={tone(sourceBadgeColor)}>
                    {entry.source}
                  </span>
                )}
                <ReviewBadge status={status} />
              </div>

              {/* Content */}
              <p className="section-row-text h-cmp-body">
                {entry.content}
              </p>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="h-cmp-wrap is-snug">
                  {tags.map((tag, i) => (
                    <span key={i} className="h-cmp-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Bottom row: timestamp + ratification buttons */}
              <div className="h-cmp-wrap h-cmp-act">
                <span className="section-row-meta h-cmp-sm">
                  {fmtTime(entry.created_at)}
                </span>

                {isPending && (
                  <div className="ratify-actions">
                    <button
                      className="ratify-btn ratify-accept h-cmp-tint h-cmp-edge"
                      disabled={isBusy}
                      onClick={() => handleAction(entry.id, "accept")}
                    >
                      {isBusy ? "…" : "accept"}
                    </button>
                    <button
                      className="ratify-btn ratify-decline"
                      disabled={isBusy}
                      onClick={() => handleAction(entry.id, "decline")}
                    >
                      {isBusy ? "…" : "decline"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
