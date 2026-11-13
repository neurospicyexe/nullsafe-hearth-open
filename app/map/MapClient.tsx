"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MapNode, MemoryMap, MapReader } from "@/lib/halseth";
import PinButton from "@/components/PinButton";

// The memory map (docs/PLAN-memory-map-2026-10-28.md, M2): force layout on a canvas, pan + pinch zoom
// from force-graph. Colour = whose it is (node owner, edge writer), so Principal's connections and each
// companion's read as theirs. Tap a node for its words, its connections, and a pin.
// M4 (Halseth 0.24.0): Principal draws their own links here -- "Link from this", tap another thing, say
// why. A mind's link (type 'linked:<writer>') draws thicker, in its writer's colour, with the why on
// hover and in the panel. Only Principal's own links offer Unlink; the companions' are theirs.

const OWNERS = ["principal", "cypher", "drevan", "gaia"] as const;
const OWNER_NAME: Record<string, string> = { principal: "Principal", cypher: "Cypher", drevan: "Drevan", gaia: "Gaia", system: "the house" };
// Canvas cannot read var(); readColors resolves the kit tokens at draw time. The browser always has
// them, so the fallback only guards a missing stylesheet.
const FALLBACK = "gray";

type GNode = MapNode & { x?: number; y?: number; degree: number };
type GLink = { source: string; target: string; type: string; writer: string; why: string | null };
type LinkFrom = { key: string; table: string; id: string; label: string };

const isLink = (type: string) => type.startsWith("linked:");
const LINK_FROM_KEY = "map-link-from";
const WHY_CHARS = 160;
// The start of a link survives "Show everything connected to this" (a new page) so Principal can walk to
// the other end. Storage can be absent (private window); the control still works within one view.
function loadLinkFrom(): LinkFrom | null {
  try {
    const v = sessionStorage.getItem(LINK_FROM_KEY);
    return v ? (JSON.parse(v) as LinkFrom) : null;
  } catch {
    return null;
  }
}
function saveLinkFrom(v: LinkFrom | null) {
  try {
    if (v) sessionStorage.setItem(LINK_FROM_KEY, JSON.stringify(v));
    else sessionStorage.removeItem(LINK_FROM_KEY);
  } catch {
    /* per-view only */
  }
}

function readColors(): Record<string, string> {
  const css = typeof window === "undefined" ? null : getComputedStyle(document.documentElement);
  const pick = (v: string) => css?.getPropertyValue(v).trim() || FALLBACK;
  return {
    principal: pick("--h-lamp"), cypher: pick("--h-cypher"), drevan: pick("--h-drevan"), gaia: pick("--h-gaia"),
    system: pick("--h-faint"), pinned: pick("--h-lamp"), label: pick("--h-ink"),
  };
}

// The theme colours are not all hex (the old violet was hsl()), and hex-alpha appended to hsl() is an
// invalid colour that canvas draws as black: every Drevan edge drew black until 10-29.
function withAlpha(c: string, a: number): string {
  const hsl = /^hsla?\(([^)]+)\)$/i.exec(c);
  if (hsl) return `hsla(${hsl[1]!.split(",").slice(0, 3).join(",")}, ${a})`;
  if (/^#[0-9a-f]{6}$/i.test(c)) return c + Math.round(a * 255).toString(16).padStart(2, "0");
  return c;
}

const ageOf = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

// /api/pin accepts only these three; a system-owned note offered a pin that always 400'd.
const PIN_OWNERS = new Set(["cypher", "drevan", "gaia"]);

export default function MapClient({ map, reader }: { map: MemoryMap; reader: MapReader }) {
  const box = useRef<HTMLDivElement>(null);
  const graph = useRef<any>(null);
  const [selected, setSelected] = useState<GNode | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  // Unconnected things hide by default: measured 10-28, 82 of 105 nodes in the everyone view had no
  // connection yet and buried the real clusters. The count stays visible so the gap is not hidden.
  const [showLonely, setShowLonely] = useState(false);
  const router = useRouter();
  const [linkFrom, setLinkFromState] = useState<LinkFrom | null>(null);
  const [why, setWhy] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  useEffect(() => setLinkFromState(loadLinkFrom()), []);
  const setLinkFrom = (v: LinkFrom | null) => {
    setLinkFromState(v);
    saveLinkFrom(v);
  };
  useEffect(() => {
    setLinkMsg(null);
    setWhy("");
  }, [selected?.key]);

  async function sendLink(body: Record<string, unknown>, done: string) {
    if (linkBusy) return;
    setLinkBusy(true);
    setLinkMsg(null);
    try {
      const res = await fetch("/api/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || out?.ok === false) {
        setLinkMsg(out?.reason ?? out?.error ?? "Could not save that.");
        return;
      }
      setLinkMsg(out?.changed === false ? "Already that way." : done);
      if (!body.unlink) setLinkFrom(null);
      setWhy("");
      router.refresh();
    } catch {
      setLinkMsg("Halseth unreachable.");
    } finally {
      setLinkBusy(false);
    }
  }

  const data = useMemo(() => {
    const degree = new Map<string, number>();
    for (const e of map.edges) {
      degree.set(e.src, (degree.get(e.src) ?? 0) + 1);
      degree.set(e.dst, (degree.get(e.dst) ?? 0) + 1);
    }
    const ownerOf = (n: MapNode) => n.owner ?? "system";
    const all: GNode[] = map.nodes
      .filter((n) => !hidden.has(ownerOf(n)))
      .map((n) => ({ ...n, degree: degree.get(n.key) ?? 0 }));
    const lonely = all.filter((n) => n.degree === 0).length;
    const nodes = showLonely ? all : all.filter((n) => n.degree > 0);
    const keep = new Set(nodes.map((n) => n.key));
    const links: GLink[] = map.edges
      .filter((e) => keep.has(e.src) && keep.has(e.dst))
      .map((e) => ({ source: e.src, target: e.dst, type: e.type, writer: e.writer, why: e.why ?? null }));
    return { nodes, links, lonely };
  }, [map, hidden, showLonely]);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    let alive = true;
    let ro: ResizeObserver | null = null;
    (async () => {
      const { default: ForceGraph } = await import("force-graph");
      if (!alive || !box.current) return;
      const colors = readColors();
      const color = (who: string | null | undefined) => colors[who ?? "system"] ?? colors.system!;
      const g = new ForceGraph(box.current)
        .backgroundColor("transparent")
        .nodeId("key")
        .linkSource("source")
        .linkTarget("target")
        .nodeLabel((n: any) => `${n.kind}: ${n.label}`)
        .linkColor((l: any) => withAlpha(color(l.writer), isLink(l.type) ? 0.8 : 0.4))
        .linkWidth((l: any) => (isLink(l.type) ? 2.2 : 1))
        // Two minds linking the same pair would draw one line over the other; each writer's links bow
        // their own way so every voice on a pair stays visible.
        .linkCurvature((l: any) => (isLink(l.type) ? ({ principal: 0.25, cypher: -0.25, drevan: 0.12, gaia: -0.12 } as Record<string, number>)[l.writer] ?? 0 : 0))
        .linkLabel((l: any) => (isLink(l.type) ? `${OWNER_NAME[l.writer] ?? l.writer}${l.why ? `: ${l.why}` : ""}` : l.type.replace(/_/g, " ")))
        .linkDirectionalArrowLength(3)
        .linkDirectionalArrowRelPos(0.9)
        .cooldownTicks(120)
        .nodeCanvasObject((n: any, ctx: CanvasRenderingContext2D, scale: number) => {
          const r = n.seed ? 5 : 3 + Math.min(4, Math.sqrt(n.degree));
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = color(n.owner);
          ctx.fill();
          if (n.pinned) {
            ctx.lineWidth = 1.5 / scale;
            ctx.strokeStyle = colors.pinned!;
            ctx.beginPath();
            ctx.arc(n.x, n.y, r + 2.5, 0, 2 * Math.PI);
            ctx.stroke();
          }
          if (scale > 1.8 || n.degree >= 3) {
            const t = n.label.length > 28 ? n.label.slice(0, 27) + "…" : n.label;
            ctx.font = `${10 / scale}px sans-serif`;
            ctx.fillStyle = withAlpha(colors.label!, 0.85);
            ctx.textAlign = "center";
            ctx.fillText(t, n.x, n.y + r + 9 / scale);
          }
        })
        .nodePointerAreaPaint((n: any, paint: string, ctx: CanvasRenderingContext2D) => {
          ctx.fillStyle = paint;
          ctx.beginPath();
          ctx.arc(n.x, n.y, 9, 0, 2 * Math.PI);
          ctx.fill();
        })
        .onNodeClick((n: any) => setSelected(n as GNode))
        .onBackgroundClick(() => setSelected(null));
      graph.current = g;
      const fit = () => {
        if (!box.current) return;
        g.width(box.current.clientWidth).height(box.current.clientHeight);
      };
      fit();
      ro = new ResizeObserver(fit);
      ro.observe(box.current);
      // dataRef, not `data`: a legend toggle made while force-graph was still importing ran the
      // [data] effect against a null graph and was lost; the ref holds whatever is current now.
      const d = dataRef.current;
      g.graphData({ nodes: d.nodes.map((n) => ({ ...n })), links: d.links.map((l) => ({ ...l })) });
      // Fit once, after the first layout. onEngineStop also fires after every drag or filter reheat,
      // which kept snapping the view back to fit-all.
      let fitted = false;
      g.onEngineStop(() => {
        if (fitted) return;
        fitted = true;
        g.zoomToFit(400, 40);
      });
    })();
    return () => {
      alive = false;
      ro?.disconnect();
      graph.current?._destructor?.();
      graph.current = null;
    };
    // The graph is built once per mount; data changes are pushed by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    graph.current?.graphData({ nodes: data.nodes.map((n) => ({ ...n })), links: data.links.map((l) => ({ ...l })) });
  }, [data]);

  const neighbours = useMemo(() => {
    if (!selected) return [];
    const byKey = new Map(map.nodes.map((n) => [n.key, n]));
    return map.edges
      .filter((e) => e.src === selected.key || e.dst === selected.key)
      .map((e) => ({ e, other: byKey.get(e.src === selected.key ? e.dst : e.src) }))
      .filter((x): x is { e: (typeof map.edges)[number]; other: MapNode } => !!x.other)
      .slice(0, 12);
  }, [selected, map]);

  const toggleOwner = (o: string) =>
    setHidden((h) => {
      const next = new Set(h);
      next.has(o) ? next.delete(o) : next.add(o);
      return next;
    });

  const pinnable = selected && (selected.table === "companion_conclusions" || selected.table === "wm_continuity_notes") && selected.owner && PIN_OWNERS.has(selected.owner);

  return (
    <div className="map-shell">
      <div className="map-legend">
        {OWNERS.map((o) => (
          <button key={o} type="button" className={`map-chip${hidden.has(o) ? " off" : ""}`} onClick={() => toggleOwner(o)} aria-pressed={!hidden.has(o)}>
            <span className={`map-dot map-dot-${o}`} />
            {OWNER_NAME[o]}
          </button>
        ))}
        {data.lonely > 0 && (
          <button type="button" className={`map-chip${showLonely ? "" : " off"}`} onClick={() => setShowLonely((v) => !v)} aria-pressed={showLonely}>
            {showLonely ? "Hide" : "Show"} {data.lonely} not connected yet
          </button>
        )}
        <span className="map-count">
          {data.nodes.length} things, {data.links.length} connections{map.truncated ? " (trimmed)" : ""}
        </span>
      </div>

      <div ref={box} className="map-canvas" />

      {selected && (
        <aside className="map-panel card">
          <div className="map-panel-head">
            <span className="badge">{selected.kind}</span>
            <span className="map-panel-who">
              {OWNER_NAME[selected.owner ?? "system"] ?? selected.owner} {ageOf(selected.created_at) && `· ${ageOf(selected.created_at)}`}
            </span>
            <button type="button" className="map-close" onClick={() => setSelected(null)} aria-label="Close">
              ×
            </button>
          </div>
          <p className="map-panel-text">{selected.text ?? selected.label}</p>
          {pinnable && (
            <PinButton
              // key: without it React reuses the instance across nodes and useState keeps the
              // previous node's pinned state (a pinned node, then an unpinned one, read "Pinned").
              key={selected.key}
              companionId={selected.owner!}
              kind={selected.table === "companion_conclusions" ? "conclusion" : "note"}
              id={selected.id}
              pinned={selected.pinned}
            />
          )}
          {neighbours.length > 0 && (
            <ul className="map-links">
              {neighbours.map(({ e, other }) => (
                <li key={`${e.src}|${e.dst}|${e.type}`}>
                  <span className={`map-dot map-dot-${e.writer}`} />
                  <span className="map-link-type">
                    {isLink(e.type) ? `linked by ${OWNER_NAME[e.writer] ?? e.writer}` : e.type.replace(/_/g, " ")}
                  </span>{" "}
                  <span className="map-link-body">
                    {other.label}
                    {isLink(e.type) && e.why && <em className="map-link-why"> {e.why}</em>}
                  </span>
                  {e.type === "linked:principal" && (
                    <button
                      type="button"
                      className="pin-btn compact"
                      disabled={linkBusy}
                      onClick={() => {
                        const [st, ...si] = e.src.split("/");
                        const [dt, ...di] = e.dst.split("/");
                        sendLink({ unlink: true, src: { table: st, id: si.join("/") }, dst: { table: dt, id: di.join("/") } }, "Unlinked.");
                      }}
                    >
                      Unlink
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="map-linker">
            {linkFrom && linkFrom.key !== selected.key ? (
              <>
                <span className="map-linker-from">
                  Link <strong>{linkFrom.label.length > 48 ? linkFrom.label.slice(0, 47) + "…" : linkFrom.label}</strong> to this
                </span>
                <input
                  className="map-why"
                  value={why}
                  maxLength={WHY_CHARS}
                  placeholder="why (optional, shown on the line)"
                  onChange={(ev) => setWhy(ev.target.value)}
                  aria-label="Why these connect"
                />
                <div className="pin-wrap">
                  <button
                    type="button"
                    className="pin-btn pinned"
                    disabled={linkBusy}
                    onClick={() => sendLink({ src: { table: linkFrom.table, id: linkFrom.id }, dst: { table: selected.table, id: selected.id }, why }, "Linked.")}
                  >
                    {linkBusy ? "Linking…" : "Link"}
                  </button>
                  <button type="button" className="pin-btn" onClick={() => setLinkFrom(null)}>
                    Cancel
                  </button>
                </div>
              </>
            ) : linkFrom ? (
              <div className="pin-wrap">
                <span className="pin-msg">Now tap the other thing to link this to.</span>
                <button type="button" className="pin-btn compact" onClick={() => setLinkFrom(null)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="pin-btn"
                onClick={() => setLinkFrom({ key: selected.key, table: selected.table, id: selected.id, label: selected.label })}
              >
                Link from this
              </button>
            )}
            {linkMsg && <span className="pin-msg">{linkMsg}</span>}
          </div>
          <Link className="map-explore" href={`/map?reader=${reader}&center=${encodeURIComponent(`${selected.table}:${selected.id}`)}&hops=2`}>
            Show everything connected to this →
          </Link>
        </aside>
      )}
    </div>
  );
}
