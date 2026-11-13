"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AutonomySeed } from "@/lib/halseth";
import { fmtTime } from "../sections";
import { seedTypeColor } from "../domain-colors";

const SEED_TYPES = ["topic", "question", "reflection_prompt"] as const;
type SeedType = typeof SEED_TYPES[number];

interface Props {
  companionId: string;
  availableSeeds: AutonomySeed[];
  usedSeeds: AutonomySeed[];
}

export default function SeedsClient({ companionId, availableSeeds, usedSeeds }: Props) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [seedType, setSeedType] = useState<SeedType>("topic");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [markingUsed, setMarkingUsed] = useState<Record<string, boolean>>({});
  const [markError, setMarkError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/mind/autonomy/seeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companion_id: companionId, content: content.trim(), seed_type: seedType }),
      });
      if (res.ok) {
        setContent("");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setAddError(data.error ?? "Failed to add seed");
      }
    } catch {
      setAddError("Network error");
    } finally {
      setAdding(false);
    }
  }

  async function handleMarkUsed(id: string) {
    setMarkingUsed((p) => ({ ...p, [id]: true }));
    setMarkError(null);
    try {
      const res = await fetch(`/api/mind/autonomy/seeds/${id}`, { method: "PATCH" });
      if (res.ok) {
        router.refresh();
      } else {
        setMarkError("Failed to mark used — try again");
      }
    } catch {
      setMarkError("Network error");
    } finally {
      setMarkingUsed((p) => ({ ...p, [id]: false }));
    }
  }

  return (
    <>
      {/* Add seed form */}
      <form onSubmit={handleAdd} className="seed-add-form h-cmp-seed-form">
        <div className="h-cmp-wrap">
          {SEED_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={`ratify-btn${seedType === t ? " ratify-accept h-cmp-tint h-cmp-edge" : ""}`}
              onClick={() => setSeedType(t)}
            >
              {t.replace("_", " ")}
            </button>
          ))}
        </div>
        <div className="h-cmp-seed-row">
          <input
            className="seed-input"
            type="text"
            placeholder="New seed content…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={adding}
          />
          <button
            type="submit"
            className="ratify-btn ratify-accept h-cmp-tint h-cmp-edge"
            disabled={adding || !content.trim()}
          >
            {adding ? "…" : "add"}
          </button>
        </div>
        {addError && (
          <p className="h-cmp-err h-cmp-tight-top">{addError}</p>
        )}
      </form>

      {markError && (
        <p className="h-cmp-err">{markError}</p>
      )}

      {availableSeeds.length === 0 && usedSeeds.length === 0 ? (
        <p className="h-empty">No seeds yet</p>
      ) : (
        <>
          <h3 className="h-cmp-sub">
            Available
          </h3>
          {availableSeeds.length === 0 ? (
            <p className="h-empty h-cmp-mb">No seeds available</p>
          ) : (
            <div className="section-list h-cmp-mb">
              {availableSeeds.map((seed) => {
                const c = seedTypeColor(seed.seed_type);
                return (
                  <div key={seed.id} className="section-row h-cmp-col">
                    <span className="h-cmp-badge" style={{ "--c": c } as React.CSSProperties}>
                      {seed.seed_type.replace("_", " ")}
                    </span>
                    <p className="section-row-text h-cmp-flush">{seed.content}</p>
                    <button
                      className="ratify-btn ratify-decline h-cmp-mini"
                      disabled={markingUsed[seed.id]}
                      onClick={() => handleMarkUsed(seed.id)}
                    >
                      {markingUsed[seed.id] ? "…" : "mark used"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {usedSeeds.length > 0 && (
            <details className="h-cmp-mt">
              <summary className="h-cmp-summary">
                {usedSeeds.length} used {usedSeeds.length === 1 ? "seed" : "seeds"}
              </summary>
              <div className="section-list h-cmp-mt-md">
                {usedSeeds.map((seed) => {
                  const c = seedTypeColor(seed.seed_type);
                  return (
                    <div key={seed.id} className="section-row h-cmp-col">
                      <span className="h-cmp-badge" style={{ "--c": c } as React.CSSProperties}>
                        {seed.seed_type.replace("_", " ")}
                      </span>
                      <p className="section-row-text h-cmp-flush h-cmp-dim">{seed.content}</p>
                      <span className="section-row-meta h-cmp-sm">
                        used {fmtTime(seed.used_at!)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </>
      )}
    </>
  );
}
