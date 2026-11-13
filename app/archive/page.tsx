import Link from "next/link";
import { CELLAR_SECTIONS } from "@/lib/shell";
import ArchiveSearch from "./ArchiveSearch";

export const metadata = { title: "Cellar | Hearth" };

// The cellar: every record, dense and grouped by the question you are asking. No tiles, no hints;
// you come down here to look something up. (/hood redirects here.)
export default function Page() {
  return (
    <div className="h-cellar">
      <h1 className="h-page-title">Cellar</h1>
      <p className="h-cellar-lede">Everything they&apos;ve kept. Look things up here.</p>
      <ArchiveSearch />
      {CELLAR_SECTIONS.map((s) => (
        <section key={s.title} aria-label={s.title} className="h-cellar-section">
          <h2 className="h-cellar-h2">{s.title}</h2>
          <ul className="h-cellar-list">
            {s.doors.map((d) => (
              <li key={d.href}>
                <Link href={d.href} className="h-cellar-link">{d.label}</Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
