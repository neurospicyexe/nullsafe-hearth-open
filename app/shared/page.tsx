import Link from "next/link";
import { fetchBridge } from "@/lib/halseth";
import { SharedGoalsClient, SharedListsClient, BridgeStatusClient } from "@/app/us/client";

export const dynamic = 'force-dynamic';

export default async function SharedPage() {
  const bridge = await fetchBridge();

  if (!bridge) {
    return (
      <>
        <div className="page-header">
          <h1 className="page-title">Shared</h1>
          <p className="page-subtitle">bridge — tasks and lists shared with partner</p>
        </div>
        <div className="pending-notice">
          <div className="pending-dot" />
          Bridge not connected. Partner data will appear here when the bridge is active.
        </div>
        <p style={{ marginTop: "1rem", fontSize: "0.78rem", color: "var(--h-muted)" }}>
          Your own tasks, events, and lists live at{" "}
          <Link href="/tasks" style={{ color: "var(--h-lamp)" }}>Tasks →</Link>
        </p>
      </>
    );
  }

  const sharing = {
    tasks:  bridge.enabled?.includes("tasks")  ?? false,
    events: bridge.enabled?.includes("events") ?? false,
    lists:  bridge.enabled?.includes("lists")  ?? false,
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Shared</h1>
        <p className="page-subtitle">
          bridge with <strong style={{ color: "var(--h-ink)" }}>{bridge.system ?? "partner"}</strong>
          {" "}— shared tasks, lists, and what you&apos;re each seeing
        </p>
      </div>

      <BridgeStatusClient sharing={sharing} />
      {bridge.tasks?.length > 0 && <SharedGoalsClient tasks={bridge.tasks} />}
      {bridge.lists?.length > 0 && <SharedListsClient lists={bridge.lists} />}

      {bridge.tasks?.length === 0 && bridge.lists?.length === 0 && (
        <p className="h-empty">
          Bridge is connected but no shared items yet. Your own tasks live at{" "}
          <Link href="/tasks" style={{ color: "var(--h-lamp)" }}>Tasks →</Link>
        </p>
      )}
    </>
  );
}
