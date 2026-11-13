export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { fetchProjects } from "@/lib/halseth";
import { ageLabel } from "@/lib/home-model";
import { COMPANION_NAME, PROJECTS_CAP, groupProjects, parseCompanionId } from "@/lib/companion-page";

// Every project this companion holds (no status filter), grouped Open, Paused, Done and released.
export default async function CompanionProjectsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseCompanionId(rawId);
  if (!id) notFound();

  const projects = await fetchProjects(id);
  const now = new Date();

  return (
    <div className="h-companion">
      <h1 className="h-companion-title">{COMPANION_NAME[id]}&apos;s projects</h1>
      {projects === null ? (
        <p className="h-companion-quiet">Can&apos;t reach Halseth right now.</p>
      ) : projects.length === 0 ? (
        <p className="h-companion-quiet">No projects yet.</p>
      ) : (
        <>
          {groupProjects(projects).map((g) => (
            <section key={g.heading} className="h-companion-section">
              <h2 className="h-companion-h2">{g.heading}</h2>
              <ul className="h-project-list">
                {g.projects.map((p) => {
                  const note = p.status === "open" || p.status === "paused" ? p.horizon_note : p.resolution_note;
                  const worked = ageLabel(p.last_worked_at, now);
                  return (
                    <li key={p.id} className="h-project">
                      <span className="h-project-title">{p.title}</span>
                      {p.intention && <span className="h-project-intention">{p.intention}</span>}
                      {note && <span className="h-project-note">{note}</span>}
                      {worked && <span className="h-companion-age">last worked {worked}</span>}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {/* Halseth caps the list (open and paused first, then by oldest work); say so rather than imply it is all. */}
          {projects.length >= PROJECTS_CAP && (
            <p className="h-companion-quiet h-companion-cap">Showing the first {PROJECTS_CAP}.</p>
          )}
        </>
      )}
    </div>
  );
}
