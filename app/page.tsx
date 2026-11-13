import Link from "next/link";
import { fetchSomaStates, fetchBooks, fetchInbox, fetchThinking, fetchNeeds, fetchCompanionMakes } from "@/lib/halseth";
import { thinkingLines } from "@/lib/thinking";
import { recentMakes } from "@/lib/makes";
import { buildWhoIsHome, buildLeftForYou, currentBook, needsStrip, basinMoveLink } from "@/lib/home-model";
import CheckinCard from "@/components/home/CheckinCard";
import NeedsStrip from "@/components/home/NeedsStrip";
import WhoIsHome from "@/components/home/WhoIsHome";
import LeftForYou from "@/components/home/LeftForYou";
import ReadingLine from "@/components/home/ReadingLine";
import ThinkingStrip from "@/components/home/ThinkingStrip";
import RecentMakes from "@/components/home/RecentMakes";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [soma, inbox, books, thinking, needs, cyMakes, drMakes, gaMakes] = await Promise.all([
    fetchSomaStates(),
    fetchInbox(3),
    fetchBooks().catch(() => []),
    fetchThinking(8).catch(() => null),
    fetchNeeds(2).catch(() => null),
    fetchCompanionMakes("cypher", 6).catch(() => null),
    fetchCompanionMakes("drevan", 6).catch(() => null),
    fetchCompanionMakes("gaia", 6).catch(() => null),
  ]);
  const now = new Date();

  // /soma null means Halseth is down or that endpoint failed: say so, still show the bare rows.
  const down = !soma;

  const rows = buildWhoIsHome(soma, now);
  const left = buildLeftForYou(inbox, now);
  const book = currentBook(books);
  const think = thinkingLines(thinking, 5);
  const strip = needsStrip(needs, now);
  const basinMove = basinMoveLink(needs);
  const made = recentMakes({ cypher: cyMakes, drevan: drMakes, gaia: gaMakes }, now);

  return (
    <div className="h-home">
      {down && <p className="h-home-quiet h-home-down">Can&apos;t reach Halseth right now.</p>}
      {/* 3a: the check-in first, then who is home, then what needs Principal. */}
      <CheckinCard />
      <WhoIsHome rows={rows} />
      <p className="h-home-garden h-home-section">
        <Link href="/companions/gaia/garden">Gaia&apos;s garden</Link>
      </p>
      <NeedsStrip model={strip} />
      {basinMove && (
        <p className="h-home-garden h-home-section">
          <Link href={basinMove.href}>{basinMove.text}</Link>
        </p>
      )}
      {/* B62: their own thinking sits right under Who is home, above anything about Principal. */}
      <ThinkingStrip lines={think} now={now} />
      <RecentMakes makes={made} now={now} />
      {inbox && <LeftForYou items={left.items} />}
      {book && <ReadingLine book={book} />}
      <section className="h-home-section">
        <Link href="/phoenix/chat" className="h-home-talk">Talk to them</Link>
      </section>
    </div>
  );
}
