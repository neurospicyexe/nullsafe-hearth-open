"use client";

import { useState } from "react";
import type { MetronomeAction } from "@/lib/halseth";
import { COMPANION_COLOR } from "@/lib/shell";

type CompanionId = "drevan" | "cypher" | "gaia";

const COMPANION_DISPLAY: Record<CompanionId, { sym: string; label: string }> = {
  drevan: { sym: "◈", label: "Drevan" },
  cypher: { sym: "⬡", label: "Cypher" },
  gaia:   { sym: "◉", label: "Gaia" },
};

const COMPANION_IDS = Object.keys(COMPANION_DISPLAY) as CompanionId[];

const ACTION_TYPES = [
  "post_heartbeat",
  "write_inter_companion",
  "write_journal",
  "write_feeling",
  "check_in_on_principal",
  "ask_question",
  "offer_presence",
  "send_reminder",
  "share_observation",
  "nothing",
] as const;

const ACTION_LABELS: Record<string, string> = {
  post_heartbeat:        "heartbeat",
  write_inter_companion: "inter-companion",
  write_journal:         "journal",
  write_feeling:         "feeling",
  check_in_on_principal:    "check in",
  ask_question:          "ask question",
  offer_presence:        "offer presence",
  send_reminder:         "reminder",
  share_observation:     "observation",
  nothing:               "nothing",
};

function ConditionBadges({ action }: { action: MetronomeAction }) {
  const badges: { label: string; title: string }[] = [];

  if (action.silence_min_hours !== null || action.silence_max_hours !== null) {
    const min = action.silence_min_hours;
    const max = action.silence_max_hours;
    const label = min !== null && max !== null
      ? `${min}h–${max}h silence`
      : min !== null
        ? `${min}h+ silence`
        : `<${max!}h silence`;
    badges.push({ label, title: "silence window condition" });
  }

  if (action.max_per_day !== null) {
    badges.push({ label: `${action.max_per_day}x/day`, title: "max fires per day" });
  }

  if (action.cooldown_hours !== null) {
    badges.push({ label: `${action.cooldown_hours}h cooldown`, title: "cooldown between fires" });
  }

  if (action.requires_signal) {
    const lookback = action.signal_lookback_hours != null ? ` (${action.signal_lookback_hours}h)` : "";
    badges.push({ label: `signal: ${action.requires_signal}${lookback}`, title: "requires this signal in recent messages" });
  }

  if (action.last_fired_at) {
    const d = new Date(action.last_fired_at);
    const hoursAgo = ((Date.now() - d.getTime()) / 3_600_000).toFixed(1);
    badges.push({ label: `fired ${hoursAgo}h ago`, title: `last fired: ${d.toISOString()}` });
  }

  if (badges.length === 0) return null;

  return (
    <div className="h-phx-conds">
      {badges.map((b) => (
        <span key={b.label} title={b.title} className="h-phx-cond">
          {b.label}
        </span>
      ))}
    </div>
  );
}

function AddForm({
  companionId,
  onAdded,
  onCancel,
}: {
  companionId: CompanionId;
  onAdded: (action: MetronomeAction) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [actionType, setActionType] = useState("post_heartbeat");
  const [target, setTarget] = useState("");
  const [prompt, setPrompt] = useState("");
  const [quietHours, setQuietHours] = useState(false);
  // condition fields
  const [silenceMin, setSilenceMin] = useState("");
  const [silenceMax, setSilenceMax] = useState("");
  const [maxPerDay, setMaxPerDay] = useState("");
  const [cooldown, setCooldown] = useState("");
  const [requiresSignal, setRequiresSignal] = useState("");
  const [signalLookback, setSignalLookback] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function parseOptFloat(v: string): number | null {
    const n = parseFloat(v);
    return v.trim() !== "" && !isNaN(n) ? n : null;
  }
  function parseOptInt(v: string): number | null {
    const n = parseInt(v, 10);
    return v.trim() !== "" && !isNaN(n) ? n : null;
  }

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/metronome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companion_id: companionId,
          name: name.trim(),
          action_type: actionType,
          target: target.trim() || null,
          prompt: prompt.trim() || null,
          quiet_hours_allowed: quietHours ? 1 : 0,
          status: "on",
          silence_min_hours: parseOptFloat(silenceMin),
          silence_max_hours: parseOptFloat(silenceMax),
          max_per_day: parseOptInt(maxPerDay),
          cooldown_hours: parseOptFloat(cooldown),
          requires_signal: requiresSignal.trim() || null,
          signal_lookback_hours: parseOptFloat(signalLookback),
        }),
      });
      if (!res.ok) { setError("failed to add"); return; }
      const data = await res.json() as MetronomeAction;
      onAdded(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-phx-form">
      <input
        className="h-input"
        placeholder="Action name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <select
        className="h-input"
        value={actionType}
        onChange={(e) => setActionType(e.target.value)}
      >
        {ACTION_TYPES.map((t) => (
          <option key={t} value={t}>
            {ACTION_LABELS[t]}
          </option>
        ))}
      </select>
      {actionType === "write_inter_companion" && (
        <input
          className="h-input"
          placeholder="Target companion"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
      )}
      <textarea
        className="h-input is-area"
        placeholder="Custom prompt (optional)"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={2}
      />

      <div className="h-phx-conds-box">
        <span className="h-phx-flabel">conditions (all optional)</span>

        <div className="h-phx-frow">
          <div className="h-phx-fcol">
            <label className="h-phx-flabel">silence min (h)</label>
            <input
              className="h-input"
              type="number"
              placeholder="e.g. 2"
              min="0"
              step="0.5"
              value={silenceMin}
              onChange={(e) => setSilenceMin(e.target.value)}
            />
          </div>
          <div className="h-phx-fcol">
            <label className="h-phx-flabel">silence max (h)</label>
            <input
              className="h-input"
              type="number"
              placeholder="e.g. 12"
              min="0"
              step="0.5"
              value={silenceMax}
              onChange={(e) => setSilenceMax(e.target.value)}
            />
          </div>
        </div>

        <div className="h-phx-frow">
          <div className="h-phx-fcol">
            <label className="h-phx-flabel">max per day</label>
            <input
              className="h-input"
              type="number"
              placeholder="e.g. 1"
              min="1"
              step="1"
              value={maxPerDay}
              onChange={(e) => setMaxPerDay(e.target.value)}
            />
          </div>
          <div className="h-phx-fcol">
            <label className="h-phx-flabel">cooldown (h)</label>
            <input
              className="h-input"
              type="number"
              placeholder="e.g. 8"
              min="0"
              step="0.5"
              value={cooldown}
              onChange={(e) => setCooldown(e.target.value)}
            />
          </div>
        </div>

        <div className="h-phx-frow">
          <div className="h-phx-fcol is-wide">
            <label className="h-phx-flabel">requires signal</label>
            <input
              className="h-input"
              placeholder="e.g. hyperfocus"
              value={requiresSignal}
              onChange={(e) => setRequiresSignal(e.target.value)}
            />
          </div>
          <div className="h-phx-fcol">
            <label className="h-phx-flabel">lookback (h)</label>
            <input
              className="h-input"
              type="number"
              placeholder="2"
              min="0.5"
              step="0.5"
              value={signalLookback}
              onChange={(e) => setSignalLookback(e.target.value)}
            />
          </div>
        </div>
      </div>

      <label className="h-phx-check">
        <input
          type="checkbox"
          checked={quietHours}
          onChange={(e) => setQuietHours(e.target.checked)}
        />
        allowed during quiet hours
      </label>
      {error && <span className="h-msg is-warn">{error}</span>}
      <div className="h-phx-btns">
        <button
          className="h-btn is-primary is-outlined"
          onClick={submit}
          disabled={saving || !name.trim()}
        >
          {saving ? "adding…" : "add"}
        </button>
        <button className="h-btn is-quiet" onClick={onCancel}>
          cancel
        </button>
      </div>
    </div>
  );
}

function CompanionPalette({
  id,
  initialActions,
}: {
  id: CompanionId;
  initialActions: MetronomeAction[];
}) {
  const [actions, setActions] = useState(initialActions);
  const [showAdd, setShowAdd] = useState(false);
  const { sym, label } = COMPANION_DISPLAY[id];

  async function toggle(action: MetronomeAction) {
    const newStatus = action.status === "on" ? "off" : "on";
    const res = await fetch(`/api/metronome/${action.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companion_id: action.companion_id, status: newStatus }),
    });
    if (res.ok) {
      setActions((prev) =>
        prev.map((a) => (a.id === action.id ? { ...a, status: newStatus } : a)),
      );
    }
  }

  async function remove(action: MetronomeAction) {
    const res = await fetch(
      `/api/metronome/${action.id}?companion_id=${encodeURIComponent(action.companion_id)}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      setActions((prev) => prev.filter((a) => a.id !== action.id));
    }
  }

  function onAdded(action: MetronomeAction) {
    setActions((prev) => [...prev, action]);
    setShowAdd(false);
  }

  const activeCount = actions.filter((a) => a.status === "on").length;

  return (
    <div className="h-phx-pal" style={{ "--c": COMPANION_COLOR[id] } as React.CSSProperties}>
      <div className="h-phx-pal-head">
        <span className="h-phx-pal-name">
          {sym} {label}
        </span>
        <span className="h-meta">
          {activeCount}/{actions.length} on
        </span>
      </div>

      {actions.length === 0 ? (
        <p className="h-empty h-phx-empty">No actions configured</p>
      ) : (
        actions.map((action) => (
          <div key={action.id} className="section-row h-phx-act">
            <div className="h-phx-act-main">
              <span
                className={`h-phx-act-name${action.status === "on" ? "" : " is-off"}`}
                title={action.prompt ?? undefined}
              >
                {action.name}
              </span>
              <ConditionBadges action={action} />
            </div>
            <span className="h-phx-badge is-sm">
              {ACTION_LABELS[action.action_type] ?? action.action_type}
            </span>
            <button
              className={`h-btn h-phx-mini${action.status === "on" ? " is-on" : ""}`}
              onClick={() => toggle(action)}
              title={action.status === "on" ? "disable" : "enable"}
            >
              {action.status}
            </button>
            <button
              className="h-btn is-danger h-phx-mini"
              onClick={() => remove(action)}
              title="delete"
            >
              ×
            </button>
          </div>
        ))
      )}

      {!showAdd ? (
        <button className="h-btn is-quiet h-phx-add" onClick={() => setShowAdd(true)}>
          + add action
        </button>
      ) : (
        <AddForm
          companionId={id}
          onAdded={onAdded}
          onCancel={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

export function MetronomeSection({
  actionsMap,
}: {
  actionsMap: Record<CompanionId, MetronomeAction[]>;
}) {
  return (
    <div className="card h-phx-note-card">
      <span className="home-section-title h-phx-label is-roomy">
        Metronome Palette
        <span className="h-phx-hint">
          actions companions pick from when the heartbeat cron fires
        </span>
      </span>
      <div className="h-phx-metro">
        {COMPANION_IDS.map((id) => (
          <CompanionPalette
            key={id}
            id={id}
            initialActions={actionsMap[id]}
          />
        ))}
      </div>
    </div>
  );
}
