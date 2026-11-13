import Link from "next/link";
import type { LeftItem } from "@/lib/home-model";
import { tint } from "@/lib/domain-colors";

export default function LeftForYou({ items }: { items: LeftItem[] }) {
  return (
    <section aria-label="Left for you" className="h-home-section">
      <div className="h-home-h2-row">
        <h2 className="h-home-h2 h-home-h2-flush">Left for you</h2>
        <Link href="/letters" className="h-home-link">everything they left</Link>
      </div>
      {items.length === 0 ? (
        <p className="h-home-quiet">Nothing waiting.</p>
      ) : (
        <div className="h-home-left">
          {items.map((n) => (
            <Link key={n.id} href={n.href} className="h-home-item">
              <span
                aria-hidden="true"
                className="h-dot has-c h-home-item-dot"
                style={{ ...tint(n.colorVar ?? "var(--h-muted)"), opacity: n.unread ? 1 : 0.35 }}
              />
              <span className="h-home-item-body">
                <span className="h-home-item-head">
                  <b>{n.who}</b>{" "}
                  <span className="h-home-item-meta">
                    {n.kind}
                    {n.when ? ` · ${n.when}` : ""}
                    {n.unread ? "" : " · read"}
                  </span>
                </span>
                <span className="h-home-item-preview">{n.preview}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
