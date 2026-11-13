import { notFound } from "next/navigation";
import { parseCompanionId } from "@/lib/companion-page";
import CompanionSubnav from "./CompanionSubnav";

// Belt and braces: a non-member id 404s at the layout for every /companions/<id>/** route; each
// page still parses the id itself before fetching (the layout does not gate page data fetching).
export default async function CompanionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = parseCompanionId(rawId);
  if (!id) notFound();
  return (
    <>
      <CompanionSubnav id={id} />
      {children}
    </>
  );
}
