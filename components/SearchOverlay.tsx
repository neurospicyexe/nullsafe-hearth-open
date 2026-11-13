'use client';

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchSearch, searchErrorMessage } from "@/lib/search-client";
import { matchPages } from "@/lib/page-index";
import { isCompanionKey, toneOf } from "@/lib/tone";

type ChipValue = "all" | "feelings" | "journal" | "dreams" | "handovers" | "tasks" | "notes" | "wounds";

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

const CHIPS: { label: string; value: ChipValue }[] = [
  { label: "All", value: "all" },
  { label: "Tasks", value: "tasks" },
  { label: "Notes", value: "notes" },
  { label: "Journal", value: "journal" },
  { label: "Feelings", value: "feelings" },
  { label: "Dreams", value: "dreams" },
  { label: "Handovers", value: "handovers" },
  { label: "Wounds", value: "wounds" },
];

const GROUP_LABELS: Record<keyof SearchResponse, string> = {
  tasks: "TASKS",
  notes: "NOTES & LETTERS",
  journal: "COMPANION JOURNAL",
  feelings: "FEELINGS & DELTAS",
  dreams: "DREAMS",
  handovers: "HANDOVERS",
  wounds: "LIVING WOUNDS",
};

const GROUP_ORDER: (keyof SearchResponse)[] = ["tasks", "notes", "wounds", "journal", "feelings", "dreams", "handovers"];

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type Preview = { before: string; match: string; after: string } | { plain: string };

function getPreview(text: string, q: string): Preview {
  const trimmed = q.trim();
  const clip = (s: string, n: number) => s.length > n ? s.slice(0, n) + "…" : s;
  if (!trimmed) return { plain: clip(text, 120) };
  const idx = text.toLowerCase().indexOf(trimmed.toLowerCase());
  if (idx === -1) return { plain: clip(text, 120) };
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + trimmed.length + 70);
  return {
    before: (start > 0 ? "…" : "") + text.slice(start, idx),
    match: text.slice(idx, idx + trimmed.length),
    after: text.slice(idx + trimmed.length, end) + (end < text.length ? "…" : ""),
  };
}

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export default function SearchOverlay({ open, onClose, initialQuery }: SearchOverlayProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState("");
  const [activeChip, setActiveChip] = useState<ChipValue>("all");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state and autofocus when open changes
  useEffect(() => {
    setQ(initialQuery ?? "");
    setResults(null);
    setLoading(false);
    setActiveChip("all");
    setError(null);
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Esc key handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Debounced fetch
  useEffect(() => {
    if (!open) return;
    if (!q.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchSearch<SearchResponse>(q, activeChip, controller.signal)
        .then((data: SearchResponse) => {
          setResults(data);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === "AbortError") return;
          setResults(null);
          setError(searchErrorMessage(err));
          setLoading(false);
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, activeChip, open]);

  if (!open) return null;

  const hasResults =
    results !== null &&
    GROUP_ORDER.some((key) => results && results[key] && results[key].length > 0);

  // Pages come from the query alone (no fetch), so they show while loading and when Halseth is down.
  const pages = matchPages(q);

  const showEmpty = q.trim() !== "" && !loading && error === null && results !== null && !hasResults && pages.length === 0;

  const goTo = (url: string) => {
    router.push(url);
    onClose();
  };

  return (
    <div
      className="search-backdrop"
      onClick={onClose}
    >
      <div
        className="search-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
      >
        <input
          ref={inputRef}
          className="search-input"
          type="text"
          maxLength={100}
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className="search-chips">
          {CHIPS.map((chip) => (
            <button
              key={chip.value}
              className={`search-chip${activeChip === chip.value ? " active" : ""}`}
              onClick={() => setActiveChip(chip.value)}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {loading ? "Searching…" : error ? `${error}${error.endsWith(".") ? "" : "."}` : showEmpty ? `No results for ${q}.` : hasResults ? `Results found for ${q}.` : ""}
        </span>

        <div className="search-results">
          {pages.length > 0 && (
            <div className="search-result-group">
              <div className="search-result-group-label">PAGES</div>
              {pages.map((p) => (
                <div
                  key={p.href}
                  className="search-result-row"
                  role="link"
                  tabIndex={0}
                  onClick={() => goTo(p.href)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") goTo(p.href);
                  }}
                >
                  <span className="search-result-text">{p.label}</span>
                  {(p.hub || p.hint) && (
                    <span className="search-result-meta-row">
                      {p.hub && <span className="search-result-agent">{p.hub}</span>}
                      {p.hint && <span className="search-result-meta">{p.hint}</span>}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div className="search-loading">searching…</div>
          )}

          {!loading && error !== null && (
            <div className="h-empty is-block">{error}</div>
          )}

          {!loading && error === null && results !== null && GROUP_ORDER.map((key) => {
            const group = results[key];
            if (!group || group.length === 0) return null;
            return (
              <div key={key} className="search-result-group">
                <div className="search-result-group-label">{GROUP_LABELS[key]}</div>
                {group.map((result) => {
                  const preview = getPreview(result.text, q);
                  const agentTone = isCompanionKey(result.agent) ? toneOf(result.agent) : null;
                  return (
                    <div
                      key={result.id}
                      className="search-result-row"
                      onClick={() => {
                        router.push(result.url);
                        onClose();
                      }}
                    >
                      <span className="search-result-text">
                        {"plain" in preview
                          ? preview.plain
                          : <>{preview.before}<mark className="search-result-highlight">{preview.match}</mark>{preview.after}</>
                        }
                      </span>
                      <span className="search-result-meta-row">
                        {agentTone && result.agent && (
                          <span className={`search-result-agent ${agentTone}`}>
                            {result.agent}
                          </span>
                        )}
                        <span className="search-result-meta">{formatDate(result.created_at)}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {showEmpty && (
            <div className="h-empty is-block">No results</div>
          )}
        </div>
      </div>
    </div>
  );
}
