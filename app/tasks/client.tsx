"use client";

import { useState } from "react";
import type { Task, CalendarEvent, ListItem } from "@/lib/halseth";
import { AddTaskForm, AddEventForm } from "./CreateForms";

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

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ── Tasks ──────────────────────────────────────────────────────────────────────

const TWO_HOURS = 2 * 60 * 60 * 1000;

function TaskSection({ tasks }: { tasks: Task[] }) {
  const [items, setItems] = useState(tasks);
  const [showDone, setShowDone] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [recentDone, setRecentDone] = useState<Map<string, number>>(new Map());

  const active = items.filter((t) => t.status !== "done");
  const done = items.filter((t) => t.status === "done");
  const visible = showDone ? items : active;

  const now = Date.now();
  const undoable = items.filter(
    (t) => t.status === "done" && recentDone.has(t.id) && now - recentDone.get(t.id)! < TWO_HOURS,
  );

  async function markDone(id: string) {
    setBusy(id);
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((t) => (t.id === id ? { ...t, status: "done" } : t)));
      setRecentDone((prev) => new Map(prev).set(id, Date.now()));
    }
    setBusy(null);
  }

  async function undoDone(id: string) {
    setBusy(id);
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "open" }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((t) => (t.id === id ? { ...t, status: "open" } : t)));
      setRecentDone((prev) => { const next = new Map(prev); next.delete(id); return next; });
    }
    setBusy(null);
  }

  if (visible.length === 0 && undoable.length === 0) {
    return (
      <>
        {done.length > 0 && (
          <div className="tp-ctrl">
            <span className="tp-ctrl-label">{done.length} completed</span>
            <button className="tp-toggle" onClick={() => setShowDone((v) => !v)}>
              {showDone ? "hide" : "show done"}
            </button>
          </div>
        )}
        <div className="h-empty is-block">all clear</div>
      </>
    );
  }

  return (
    <>
      {undoable.map((task) => (
        <div key={`undo-${task.id}`} className="tp-undo-row">
          <span>✓ {task.title}</span>
          <button className="tp-undo-btn" onClick={() => undoDone(task.id)} disabled={busy === task.id}>
            undo
          </button>
        </div>
      ))}
      {done.length > 0 && (
        <div className="tp-ctrl">
          <span className="tp-ctrl-label">
            {active.length} active · {done.length} done
          </span>
          <button className="tp-toggle" onClick={() => setShowDone((v) => !v)}>
            {showDone ? "hide done" : "show done"}
          </button>
        </div>
      )}
      {visible.map((task, i) => (
        <div
          key={task.id}
          className={`tp-task${task.status === "done" ? " tp-done" : ""}`}
          style={{ animationDelay: `${i * 26}ms` }}
        >
          <span className={`tp-strip tp-strip-${task.priority}`} />
          <span className={`tp-dot tp-dot-${task.status}`} />
          <button
            className={`tp-check${task.status === "done" ? " on" : ""}`}
            onClick={() => task.status !== "done" && markDone(task.id)}
            disabled={busy === task.id || task.status === "done"}
          >
            <Check />
          </button>
          <div className="tp-task-body">
            <span className="tp-task-title">{task.title}</span>
            {task.description && (
              <div className="tp-task-desc">{task.description}</div>
            )}
            {(task.priority !== "normal" ||
              task.status === "in_progress" ||
              task.due_at ||
              task.assigned_to) && (
              <div className="tp-task-meta">
                {task.priority === "urgent" && (
                  <span className="tp-badge tp-badge-urgent">urgent</span>
                )}
                {task.priority === "high" && (
                  <span className="tp-badge tp-badge-high">high</span>
                )}
                {task.status === "in_progress" && (
                  <span className="tp-badge tp-badge-prog">in progress</span>
                )}
                {task.due_at && (
                  <span className="tp-badge">due {fmtDate(task.due_at)}</span>
                )}
                {task.assigned_to && (
                  <span className="tp-badge">→ {task.assigned_to}</span>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

// ── Events ─────────────────────────────────────────────────────────────────────

function EventSection({ events }: { events: CalendarEvent[] }) {
  const now = Date.now();
  const upcoming = events.filter(
    (e) => new Date(e.start_time).getTime() >= now - 3_600_000,
  );
  const past = events.filter(
    (e) => new Date(e.start_time).getTime() < now - 3_600_000,
  );
  const [showPast, setShowPast] = useState(false);
  const visible = showPast ? [...past.slice().reverse(), ...upcoming] : upcoming;

  if (upcoming.length === 0 && !showPast) {
    return (
      <>
        {past.length > 0 && (
          <div className="tp-ctrl">
            <span className="tp-ctrl-label">{past.length} past</span>
            <button className="tp-toggle" onClick={() => setShowPast(true)}>
              show past
            </button>
          </div>
        )}
        <div className="h-empty is-block">no upcoming events</div>
      </>
    );
  }

  return (
    <>
      {past.length > 0 && (
        <div className="tp-ctrl">
          <span className="tp-ctrl-label">{upcoming.length} upcoming</span>
          <button className="tp-toggle" onClick={() => setShowPast((v) => !v)}>
            {showPast ? "hide past" : `+${past.length} past`}
          </button>
        </div>
      )}
      {visible.map((event, i) => {
        const isPast = new Date(event.start_time).getTime() < now - 3_600_000;
        return (
          <div
            key={event.id}
            className={`tp-event${isPast ? " tp-past" : ""}`}
            style={{ animationDelay: `${i * 26}ms` }}
          >
            <div className="tp-tl-col">
              <span className="tp-tl-dot" />
              {i < visible.length - 1 && <span className="tp-tl-line" />}
            </div>
            <div className="tp-event-body">
              <div className="tp-event-title">{event.title}</div>
              <div className="tp-event-meta">
                <span className="tp-event-time">{fmtDateTime(event.start_time)}</span>
                {event.end_time && (
                  <span className="tp-event-time">→ {fmtDateTime(event.end_time)}</span>
                )}
                {event.category && (
                  <span className="tp-event-cat">{event.category}</span>
                )}
              </div>
              {event.description && (
                <div className="tp-event-desc">{event.description}</div>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ── Lists ──────────────────────────────────────────────────────────────────────

function ListSection({ listItems }: { listItems: ListItem[] }) {
  const [items, setItems] = useState(listItems);
  const [showCompleted, setShowCompleted] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const byList = items.reduce<Record<string, ListItem[]>>((acc, item) => {
    (acc[item.list_name] ??= []).push(item);
    return acc;
  }, {});
  const listNames = Object.keys(byList).sort();
  const totalDone = items.filter((i) => i.completed).length;

  async function complete(id: string) {
    setBusy(id);
    const res = await fetch(`/api/lists/${id}/complete`, { method: "POST" });
    if (res.ok) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, completed: 1 } : i)));
    }
    setBusy(null);
  }

  if (listNames.length === 0) {
    return <div className="h-empty is-block">no lists yet</div>;
  }

  return (
    <>
      {totalDone > 0 && (
        <div className="tp-ctrl">
          <span className="tp-ctrl-label">
            {items.filter((i) => !i.completed).length} remaining · {totalDone} done
          </span>
          <button className="tp-toggle" onClick={() => setShowCompleted((v) => !v)}>
            {showCompleted ? "hide done" : "show done"}
          </button>
        </div>
      )}
      {listNames.map((name) => {
        const all = byList[name];
        const visible = showCompleted ? all : all.filter((i) => !i.completed);
        const remaining = all.filter((i) => !i.completed).length;

        return (
          <div key={name}>
            <div className="tp-list-header">
              <span>{name}</span>
              <span style={{ fontWeight: 400, letterSpacing: 0, color: "var(--h-line)" }}>
                {remaining} left
              </span>
            </div>
            {visible.length === 0 ? (
              <div className="h-empty is-block" style={{ padding: "0.75rem 1rem" }}>
                done!
              </div>
            ) : (
              visible.map((item, i) => (
                <div
                  key={item.id}
                  className={`tp-item${item.completed ? " tp-item-done" : ""}`}
                  style={{ animationDelay: `${i * 20}ms` }}
                >
                  <button
                    className={`tp-rcheck${item.completed ? " on" : ""}`}
                    onClick={() => !item.completed && complete(item.id)}
                    disabled={busy === item.id || !!item.completed}
                  >
                    <Check />
                  </button>
                  <span className="tp-item-text">{item.item_text}</span>
                  {item.added_by && (
                    <span className="tp-item-by">{item.added_by}</span>
                  )}
                </div>
              ))
            )}
          </div>
        );
      })}
    </>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

type Tab = "tasks" | "events" | "lists";

export default function TasksClient({
  tasks,
  events,
  listItems,
}: {
  tasks: Task[];
  events: CalendarEvent[];
  listItems: ListItem[];
}) {
  const [tab, setTab] = useState<Tab>("tasks");

  const now = Date.now();
  const activeTasks = tasks.filter((t) => t.status !== "done").length;
  const upcomingEvents = events.filter(
    (e) => new Date(e.start_time).getTime() >= now - 3_600_000,
  ).length;
  const remainingItems = listItems.filter((i) => !i.completed).length;

  return (
    <div className="tp-shell">
      <div className="tp-tabs">
        <button
          className={`tp-tab${tab === "tasks" ? " active" : ""}`}
          onClick={() => setTab("tasks")}
        >
          Tasks
          <span className="tp-tab-count">{activeTasks}</span>
        </button>
        <button
          className={`tp-tab${tab === "events" ? " active" : ""}`}
          onClick={() => setTab("events")}
        >
          Events
          <span className="tp-tab-count">{upcomingEvents}</span>
        </button>
        <button
          className={`tp-tab${tab === "lists" ? " active" : ""}`}
          onClick={() => setTab("lists")}
        >
          Lists
          <span className="tp-tab-count">{remainingItems}</span>
        </button>
      </div>
      <div className="tp-content">
        {tab === "tasks" && (
          <>
            <AddTaskForm />
            <TaskSection tasks={tasks} />
          </>
        )}
        {tab === "events" && (
          <>
            <AddEventForm />
            <EventSection events={events} />
          </>
        )}
        {tab === "lists" && <ListSection listItems={listItems} />}
      </div>
    </div>
  );
}
