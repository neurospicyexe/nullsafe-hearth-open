import { fetchTasks, fetchEvents, fetchLists } from "@/lib/halseth";
import TasksClient from "./client";

export const dynamic = "force-dynamic";

const STATUS_ORDER: Record<string, number> = { open: 0, in_progress: 1, done: 2 };
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export default async function TasksPage() {
  const [tasks, events, listItems] = await Promise.all([
    fetchTasks(),
    fetchEvents(),
    fetchLists(),
  ]);

  const sortedTasks = [...tasks].sort((a, b) => {
    const sd = (STATUS_ORDER[a.status] ?? 1) - (STATUS_ORDER[b.status] ?? 1);
    if (sd !== 0) return sd;
    return (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
  });

  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  );

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Tasks</h1>
        <p className="page-subtitle">tasks, lists, and upcoming events</p>
      </div>
      <TasksClient tasks={sortedTasks} events={sortedEvents} listItems={listItems} />
    </>
  );
}
