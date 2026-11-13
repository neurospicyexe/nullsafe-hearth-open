export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import { parseCompanionId } from "@/lib/companion-page";
import { fetchCypherAudit } from "@/lib/halseth";
import { CypherAuditSection } from "../sections";

export function generateStaticParams() {
  return [{ id: "cypher" }];
}

export default async function CompanionAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseCompanionId(rawId);
  if (id !== "cypher") notFound();

  const auditEntries = await fetchCypherAudit(200);

  return (
    <div>
      <h1 className="h-cmp-title">Cypher · Audit Log</h1>
      <CypherAuditSection entries={auditEntries ?? []} />
    </div>
  );
}
