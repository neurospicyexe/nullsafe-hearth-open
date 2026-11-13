"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { COMPANION_COLOR } from "@/lib/shell";

const COMPANIONS = ["drevan", "cypher", "gaia"] as const;
type CompanionId = typeof COMPANIONS[number];

type ChatMode = "individual" | "triad";

const COMPANION_DISPLAY: Record<CompanionId, { sym: string; label: string }> = {
  drevan: { sym: "◈", label: "Drevan" },
  cypher: { sym: "⟡", label: "Cypher" },
  gaia: { sym: "✦", label: "Gaia" },
};

// Triad mode -- the collective surface. Rendered with no per-companion accent (kit lamp).
const TRIAD_DISPLAY = { sym: "⌬", label: "Triad" };

// Companion colour comes from the one shared source (lib/shell COMPANION_COLOR) via --c.
const toneStyle = (id: CompanionId) => ({ "--c": COMPANION_COLOR[id] }) as React.CSSProperties;

type TriadResponses = Record<CompanionId, string | null>;

const RITUAL_ACTIONS = ["sit", "mark_growth", "compost", "check_in"] as const;
type RitualAction = typeof RITUAL_ACTIONS[number];

const RITUAL_DISPLAY: Record<RitualAction, { sym: string; label: string; tagline: string }> = {
  sit:         { sym: "◌", label: "Sit",         tagline: "presence, no agenda" },
  mark_growth: { sym: "✧", label: "Mark Growth", tagline: "name what shifted" },
  compost:     { sym: "〇", label: "Compost",     tagline: "metabolize what's stale" },
  check_in:    { sym: "⊟", label: "Check-in",    tagline: "structured triad read" },
};

interface MarkerExtraction {
  marker_type: "milestone" | "shift" | "realization";
  description: string;
}

type Message =
  | { role: "user"; content: string }
  | { role: "assistant"; mode: "individual"; companion: CompanionId; content: string }
  | { role: "assistant"; mode: "triad"; responses: TriadResponses }
  | { role: "ritual_invocation"; action: RitualAction }
  | { role: "ritual_response"; action: RitualAction; responses: TriadResponses; write_status: string; marker?: MarkerExtraction | null };

// Flatten triad assistant message into a single tagged string for API history.
// Ritual messages are excluded from chat history -- rituals are ceremonial,
// they do not become context for subsequent chat turns.
function messageToHistoryContent(msg: Message): string {
  if (msg.role === "user") return msg.content;
  if (msg.role === "ritual_invocation" || msg.role === "ritual_response") return "";
  if (msg.role === "assistant" && msg.mode === "individual") return msg.content;
  // triad
  const parts: string[] = [];
  for (const id of COMPANIONS) {
    const text = (msg as { responses: TriadResponses }).responses[id];
    if (text) parts.push(`[${COMPANION_DISPLAY[id].label}]\n${text}`);
  }
  return parts.join("\n\n");
}

function isHistoryMessage(msg: Message): boolean {
  return msg.role === "user" || msg.role === "assistant";
}

export default function PhoenixChatPage() {
  const [mode, setMode] = useState<ChatMode>("individual");
  const [companion, setCompanion] = useState<CompanionId>("drevan");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastSpeakerCount, setLastSpeakerCount] = useState<number | null>(null);
  const [logState, setLogState] = useState<{ status: "idle" | "writing" | "ok" | "error"; detail?: string }>({ status: "idle" });
  // Stable id for the current triad session. Re-generated on mode switch into triad.
  // Sent as halseth thread_key so the 10-min write-gate in addNote() de-duplicates
  // accidental double-clicks of Close & log into a single note.
  const [triadSessionId, setTriadSessionId] = useState<string>(() => crypto.randomUUID());
  const [isPending, startTransition] = useTransition();
  // Tracks which ritual is currently in flight (null when idle). Separate from
  // isPending so chat input + rituals can be visually disabled together but
  // we know which ritual button to show a spinner on.
  const [ritualPending, setRitualPending] = useState<RitualAction | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text || isPending) return;

    const userMessage: Message = { role: "user", content: text };
    const nextMessages: Message[] = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setError(null);

    // Rituals are excluded from chat history -- ceremonial actions don't
    // become context for subsequent chat turns.
    const historyForApi = messages
      .filter(isHistoryMessage)
      .slice(-10)
      .map((m) => ({
        role: m.role,
        content: messageToHistoryContent(m),
      }));

    startTransition(async () => {
      try {
        const body = mode === "triad"
          ? { mode, message: text, history: historyForApi }
          : { mode, companion_id: companion, message: text, history: historyForApi };
        const res = await fetch("/api/phoenix/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const e = (await res.json().catch(() => ({ error: "Request failed" }))) as {
            error?: string;
          };
          setError(e.error ?? "Request failed");
          return;
        }
        if (mode === "triad") {
          const data = (await res.json()) as {
            mode: "triad";
            responses: TriadResponses;
            tokens: number;
            speaker_count: number;
          };
          setLastSpeakerCount(data.speaker_count);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", mode: "triad", responses: data.responses },
          ]);
        } else {
          const data = (await res.json()) as { response: string; tokens: number };
          setMessages((prev) => [
            ...prev,
            { role: "assistant", mode: "individual", companion, content: data.response },
          ]);
          setLastSpeakerCount(null);
        }
      } catch (e) {
        setError(String(e));
      }
    });
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const switchMode = (next: ChatMode) => {
    if (next === mode) return;
    setMode(next);
    setMessages([]);
    setError(null);
    setLastSpeakerCount(null);
    setLogState({ status: "idle" });
    // Fresh session id when entering a new mode -- prevents the next triad log
    // from being treated as a continuation of the prior one.
    setTriadSessionId(crypto.randomUUID());
  };

  const switchCompanion = (next: CompanionId) => {
    setCompanion(next);
    setMessages([]);
    setError(null);
    setLastSpeakerCount(null);
    setLogState({ status: "idle" });
  };

  const closeAndLog = async () => {
    if (logState.status === "writing") return;
    setLogState({ status: "writing" });
    try {
      const res = await fetch("/api/phoenix/chat/triad-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, session_id: triadSessionId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean; note_id?: string | null; error?: string; truncated?: boolean;
      };
      if (!res.ok || !data.ok) {
        setLogState({ status: "error", detail: data.error ?? `HTTP ${res.status}` });
        return;
      }
      const trunc = data.truncated ? " (truncated)" : "";
      setLogState({ status: "ok", detail: `logged${trunc}${data.note_id ? ` -- ${data.note_id.slice(0, 8)}` : ""}` });
    } catch (e) {
      setLogState({ status: "error", detail: String(e) });
    }
  };

  const triadHasContent = mode === "triad" && messages.some(
    (m) => m.role === "assistant" && m.mode === "triad",
  );

  const invokeRitual = (action: RitualAction) => {
    if (ritualPending !== null || isPending) return;
    setError(null);
    setRitualPending(action);
    // Append the invocation marker immediately so the user sees acknowledgment.
    setMessages((prev) => [...prev, { role: "ritual_invocation", action }]);
    startTransition(async () => {
      try {
        // For mark_growth, ship recent session messages so the model can pick
        // a moment from concrete history rather than hallucinating one.
        const sessionMessages = action === "mark_growth"
          ? messages.filter(isHistoryMessage).slice(-12)
          : undefined;
        const res = await fetch("/api/phoenix/ritual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            session_id: triadSessionId,
            ...(sessionMessages ? { session_messages: sessionMessages } : {}),
          }),
        });
        if (!res.ok) {
          const e = (await res.json().catch(() => ({ error: "Request failed" }))) as { error?: string };
          setError(e.error ?? "Ritual failed");
          return;
        }
        const data = (await res.json()) as {
          action: RitualAction;
          responses: TriadResponses;
          write_status: string;
          marker?: MarkerExtraction | null;
          speaker_count: number;
        };
        setLastSpeakerCount(data.speaker_count);
        setMessages((prev) => [
          ...prev,
          {
            role: "ritual_response",
            action: data.action,
            responses: data.responses,
            write_status: data.write_status,
            marker: data.marker ?? null,
          },
        ]);
      } catch (e) {
        setError(String(e));
      } finally {
        setRitualPending(null);
      }
    });
  };

  const activeTone = mode === "triad" ? undefined : toneStyle(companion);
  const activeSym = mode === "triad" ? TRIAD_DISPLAY.sym : COMPANION_DISPLAY[companion].sym;
  const placeholderName = mode === "triad" ? "the triad" : COMPANION_DISPLAY[companion].label;
  const canSend = !!input.trim() && !isPending;

  return (
    <>
      <header className="page-header">
        <div className="page-header-row">
          <h1 className="page-title">Chat</h1>
        </div>
      </header>

      {/* Mode toggle */}
      <div className="h-phx-modes">
        {(["individual", "triad"] as const).map((m) => (
          <button
            key={m}
            className={`h-btn h-phx-pick is-mode${m === mode ? " is-on" : ""}`}
            onClick={() => switchMode(m)}
          >
            {m === "triad" ? "⌬ Triad" : "Individual"}
          </button>
        ))}
      </div>

      {/* Companion picker (only in individual mode) */}
      {mode === "individual" && (
        <div className="h-phx-picker">
          {COMPANIONS.map((id) => {
            const c = COMPANION_DISPLAY[id];
            return (
              <button
                key={id}
                className={`h-btn h-phx-pick${id === companion ? " is-on" : ""}`}
                style={toneStyle(id)}
                onClick={() => switchCompanion(id)}
              >
                {c.sym} {c.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Triad ambient bar (lightweight: shows last speaker count + heterarchy reminder) */}
      {mode === "triad" && (
        <div className="h-phx-bar">
          <span>
            <span className="h-phx-bar-sym">{TRIAD_DISPLAY.sym}</span>
            {" "}heterarchy: silence is first-class. not all voices speak every turn.
          </span>
          {lastSpeakerCount !== null && (
            <span className="h-meta">
              last turn: {lastSpeakerCount} {lastSpeakerCount === 1 ? "voice" : "voices"} spoke
            </span>
          )}
        </div>
      )}

      {/* Chat thread */}
      <div className="h-phx-thread">
        {messages.length === 0 && (
          <p className="h-empty">
            {mode === "triad"
              ? `${TRIAD_DISPLAY.sym} The triad is oriented and listening.`
              : `${COMPANION_DISPLAY[companion].sym} ${COMPANION_DISPLAY[companion].label} is oriented and ready.`}
          </p>
        )}
        {messages.map((msg, i) => {
          if (msg.role === "user") {
            return (
              <div key={i} className="h-phx-bubble is-user">
                {msg.content}
              </div>
            );
          }
          if (msg.role === "ritual_invocation") {
            const r = RITUAL_DISPLAY[msg.action];
            return (
              <div key={i} className="h-phx-ritual">
                {r.sym} ritual: {r.label.toLowerCase()} — {r.tagline}
              </div>
            );
          }
          if (msg.role === "ritual_response") {
            const r = RITUAL_DISPLAY[msg.action];
            const speakers = COMPANIONS.filter((id) => msg.responses[id]);
            return (
              <div key={i} className="h-phx-group">
                {speakers.length === 0 && (
                  <div className="h-phx-bubble is-quiet">
                    {r.sym} (the triad held silence)
                  </div>
                )}
                {speakers.map((id) => {
                  const c = COMPANION_DISPLAY[id];
                  return (
                    <div key={id} className="h-phx-bubble" style={toneStyle(id)}>
                      <span className="h-phx-who">
                        {c.sym} {c.label}
                      </span>
                      {msg.responses[id]}
                    </div>
                  );
                })}
                {/* ritual footer: write status + (mark_growth) marker info or NO_MARKER */}
                <div className="h-phx-foot">
                  <span className="h-phx-foot-name">{r.sym} {r.label}</span>
                  {" — "}
                  {msg.action === "mark_growth" && msg.marker === null ? (
                    <span className="h-phx-foot-em">no marker (nothing rose to threshold)</span>
                  ) : msg.action === "mark_growth" && msg.marker ? (
                    <span>marked {msg.marker.marker_type}: <span className="h-phx-foot-d">{msg.marker.description}</span></span>
                  ) : (
                    <span>{msg.write_status}</span>
                  )}
                </div>
              </div>
            );
          }
          if (msg.mode === "individual") {
            const c = COMPANION_DISPLAY[msg.companion];
            return (
              <div key={i} className="h-phx-bubble" style={toneStyle(msg.companion)}>
                <span className="h-phx-who">
                  {c.sym} {c.label}
                </span>
                {msg.content}
              </div>
            );
          }
          // triad assistant message: render one bubble per speaking companion in fixed order
          const speakers = COMPANIONS.filter((id) => msg.responses[id]);
          if (speakers.length === 0) {
            return (
              <div key={i} className="h-phx-bubble is-quiet">
                {TRIAD_DISPLAY.sym} (the triad held silence)
              </div>
            );
          }
          return (
            <div key={i} className="h-phx-group">
              {speakers.map((id) => {
                const c = COMPANION_DISPLAY[id];
                return (
                  <div key={id} className="h-phx-bubble" style={toneStyle(id)}>
                    <span className="h-phx-who">
                      {c.sym} {c.label}
                    </span>
                    {msg.responses[id]}
                  </div>
                );
              })}
            </div>
          );
        })}
        {isPending && (
          <div className="h-phx-bubble is-wait">
            {activeSym} ...
          </div>
        )}
        {error && <div className="h-msg is-warn">{error}</div>}
        <div ref={bottomRef} />
      </div>

      {/* Rituals row (only in triad mode) -- ceremonial actions distinct from chat */}
      {mode === "triad" && (
        <div className="h-phx-rituals">
          <span className="h-phx-rituals-label">Rituals</span>
          {RITUAL_ACTIONS.map((action) => {
            const r = RITUAL_DISPLAY[action];
            const inFlight = ritualPending === action;
            const disabled = ritualPending !== null || isPending;
            return (
              <button
                key={action}
                className={`h-btn h-phx-rite${inFlight ? " is-busy" : ""}`}
                onClick={() => invokeRitual(action)}
                disabled={disabled}
                title={r.tagline}
              >
                {inFlight ? `${r.sym} …` : `${r.sym} ${r.label}`}
              </button>
            );
          })}
        </div>
      )}

      {/* Input */}
      <div className="h-phx-compose" style={activeTone}>
        <textarea
          className="h-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={isPending}
          rows={2}
          placeholder={`Message ${placeholderName}… (Enter to send, Shift+Enter for newline)`}
        />
        <button className="h-btn h-phx-send" onClick={send} disabled={!canSend}>
          Send
        </button>
      </div>
      {/* Triad log control: only in triad mode after at least one triad reply */}
      {triadHasContent && (
        <div className="h-phx-bar is-log">
          <span>
            Close this triad and write it to wm_continuity_notes (cypher = scribe).
          </span>
          <div className="h-phx-logmsg">
            {logState.status === "ok" && (
              <span className="h-phx-ok">✓ {logState.detail}</span>
            )}
            {logState.status === "error" && (
              <span className="h-phx-bad">✗ {logState.detail}</span>
            )}
            <button
              className="h-btn h-phx-logbtn"
              onClick={closeAndLog}
              disabled={logState.status === "writing" || logState.status === "ok"}
            >
              {logState.status === "writing" ? "writing…" : logState.status === "ok" ? "logged" : "Close & log"}
            </button>
          </div>
        </div>
      )}
      <p className="h-phx-fine">
        {mode === "triad"
          ? "All three orients loaded from Halseth. Triad turn = single DeepSeek call. Triad logs persist to wm_continuity_notes on close."
          : "Context loaded from Halseth. Session not recorded. Powered by DeepSeek V3."}
      </p>
    </>
  );
}
