export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchInboxItem } from "@/lib/halseth";
import { agentIdentity } from "@/lib/home-model";
import { parseUtc } from "@/lib/spoons";
import ClientTime from "@/components/ClientTime";
import MarkRead from "./MarkRead";

export const metadata = { title: "Letter | Hearth" };

export default async function LetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await fetchInboxItem(id);
  if (!item) notFound();
  const { who, colorVar } = agentIdentity(item.agent);
  const when = parseUtc(item.created_at);

  return (
    <article className="h-letter">
      <MarkRead id={item.id} />
      <Link href="/letters" className="h-home-link">All letters</Link>
      <h1 className="h-letter-from" style={{ "--c": colorVar ?? "var(--h-muted)" } as React.CSSProperties}>{who}</h1>
      {when && (
        <p className="h-letter-when"><ClientTime iso={when.toISOString()} /></p>
      )}
      <div className="h-letter-text">{item.text}</div>
    </article>
  );
}
