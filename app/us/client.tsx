"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type BridgeData } from "@/lib/halseth";

function Check() {
  return (
    <svg viewBox="0 0 10 8" aria-hidden>
      <polyline points="1.5,4.2 3.8,6.8 8.5,1.5" />
    </svg>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const BRIDGE_DESC: Record<string, string> = {
  tasks:  "your open tasks and priorities",
  events: "calendar events and schedule",
  lists:  "shopping and shared checklists",
};

// ── Shared Goals ──────────────────────────────────────────────────────────────

export function SharedGoalsClient({ tasks }: { tasks: BridgeData["tasks"] }) {
  const router = useRouter();
  const [done, setDone] = useState<Set<string>>(
    new Set(tasks.filter((t) => t.status === "done").map((t) => t.id))
  );

  async function toggle(id: string) {
    const isDone = done.has(id);
    setDone((prev) => {
      const next = new Set(prev);
      isDone ? next.delete(id) : next.add(id);
      return next;
    });
    await fetch("/api/bridge/act", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "task_status", id, status: isDone ? "open" : "done" }),
    });
    router.refresh();
  }

  return (
    <div className="tp-shell" style={{ marginBottom: "1.25rem" }}>
      <div className="bridge-section-header">
        <span>Shared Goals</span>
        <span className="bridge-from-badge">from partner</span>
      </div>
      <div className="tp-content">
        {tasks.length === 0 ? (
          <div className="h-empty is-block">no shared tasks from partner yet</div>
        ) : (
          tasks.map((t, i) => (
            <div
              key={t.id}
              className={`tp-task${done.has(t.id) ? " tp-done" : ""}`}
              style={{ animationDelay: `${i * 26}ms` }}
            >
              <span className={`tp-strip tp-strip-${t.priority}`} />
              <button
                className={`tp-check${done.has(t.id) ? " on" : ""}`}
                onClick={() => toggle(t.id)}
              >
                <Check />
              </button>
              <div className="tp-task-body">
                <span className="tp-task-title">{t.title}</span>
                <div className="tp-task-meta">
                  {t.priority !== "normal" && (
                    <span className={`tp-badge tp-badge-${t.priority}`}>{t.priority}</span>
                  )}
                  <span className="tp-badge bridge-badge">bridge</span>
                  {t.due_at && <span className="tp-badge">due {fmtDate(t.due_at)}</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Shared Lists ──────────────────────────────────────────────────────────────

export function SharedListsClient({ lists }: { lists: BridgeData["lists"] }) {
  const router = useRouter();
  const [completed, setCompleted] = useState<Set<string>>(
    new Set(lists.filter((l) => l.completed).map((l) => l.id))
  );

  async function complete(id: string) {
    if (completed.has(id)) return;
    setCompleted((prev) => new Set(Array.from(prev).concat(id)));
    await fetch("/api/bridge/act", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list_complete", id }),
    });
    router.refresh();
  }

  const grouped = lists.reduce<Record<string, BridgeData["lists"]>>((acc, item) => {
    (acc[item.list_name] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="tp-shell" style={{ marginBottom: "1.25rem" }}>
      <div className="bridge-section-header">
        <span>Shared Lists</span>
        <span className="bridge-from-badge">from partner</span>
      </div>
      <div className="tp-content" style={{ padding: "0.25rem 0" }}>
        {lists.length === 0 ? (
          <div className="h-empty is-block">no shared lists from partner yet</div>
        ) : (
          Object.entries(grouped).map(([listName, items]) => (
            <div key={listName}>
              <div className="tp-list-header">{listName}</div>
              {items.map((item, i) => (
                <div
                  key={item.id}
                  className={`tp-item${completed.has(item.id) ? " tp-item-done" : ""}`}
                  style={{ animationDelay: `${i * 20}ms` }}
                >
                  <button
                    className={`tp-rcheck${completed.has(item.id) ? " on" : ""}`}
                    onClick={() => complete(item.id)}
                    disabled={completed.has(item.id)}
                  >
                    <Check />
                  </button>
                  <span className="tp-item-text">{item.item_text}</span>
                  <span className="tp-badge bridge-badge" style={{ flexShrink: 0 }}>bridge</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Bridge Status ─────────────────────────────────────────────────────────────

type SharingState = { tasks: boolean; events: boolean; lists: boolean };

export function BridgeStatusClient({ sharing }: { sharing: SharingState }) {
  const [state, setState] = useState(sharing);
  const [saving, setSaving] = useState<string | null>(null);

  async function toggle(category: "tasks" | "events" | "lists") {
    const enabled = !state[category];
    setState((prev) => ({ ...prev, [category]: enabled }));
    setSaving(category);
    // Optimistic, but roll back on failure: a rejected toggle used to stay flipped on screen.
    const ok = await fetch("/api/bridge/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, enabled }),
    }).then((r) => r.ok).catch(() => false);
    if (!ok) setState((prev) => ({ ...prev, [category]: !enabled }));
    setSaving(null);
  }

  return (
    <div className="bridge-card">
      <div className="bridge-card-header">
        <div className="bridge-dot connected" />
        <span className="bridge-card-title">Your Sharing</span>
        <span className="bridge-card-sub">controls what your partner can see</span>
      </div>
      <div className="bridge-rows">
        {(["tasks", "events", "lists"] as const).map((cat) => (
          <div key={cat} className={`bridge-row${state[cat] ? " active" : ""}`}>
            <div className="bridge-row-info">
              <span className="bridge-row-name">{cat}</span>
              <span className="bridge-row-desc">{BRIDGE_DESC[cat]}</span>
            </div>
            <button
              className={`bridge-toggle${state[cat] ? " on" : ""}`}
              onClick={() => toggle(cat)}
              disabled={saving === cat}
            >
              {saving === cat ? "…" : state[cat] ? "sharing" : "off"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
