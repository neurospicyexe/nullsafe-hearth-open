import Link from "next/link";
import Image from "next/image";
import { COMPANION_COLOR } from "@/lib/shell";

type MoodData = { emotion: string; intensity: number; at: string } | undefined;

const COMPANION_META: Record<string, { sym: string; color: string }> = {
  drevan: { sym: "◈", color: COMPANION_COLOR.drevan },
  cypher: { sym: "⟡", color: COMPANION_COLOR.cypher },
  gaia:   { sym: "✦", color: COMPANION_COLOR.gaia },
};

function intensityToLabel(n: number): string {
  if (n >= 80) return "strong";
  if (n >= 50) return "present";
  if (n >= 25) return "quiet";
  return "faint";
}

export default function CompanionMoodCard({
  companionId,
  displayName,
  mood,
  avatarUrl,
}: {
  companionId: string;
  displayName: string;
  mood: MoodData;
  avatarUrl?: string | null;
}) {
  const meta = COMPANION_META[companionId] ?? { sym: "◉", color: "var(--h-muted)" };

  return (
    <Link href={`/companions/${companionId}`} className="companion-mood-card" style={{ "--c": meta.color } as React.CSSProperties}>
      {/* Avatar: image if set, otherwise text symbol */}
      <div className="companion-mood-avatar">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={displayName}
            width={48}
            height={48}
            className="companion-mood-img"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div className="companion-mood-sym">{meta.sym}</div>
        )}
      </div>

      {/* Name + mood state */}
      <div className="companion-mood-body">
        <div className="companion-mood-name h-cmp-tint">{displayName}</div>
        {mood ? (
          <div className="companion-mood-state">
            <span className="companion-mood-emotion">{mood.emotion}</span>
            <span style={{ margin: "0 0.35rem", opacity: 0.5 }}>•</span>
            <span className="companion-mood-intensity">{intensityToLabel(mood.intensity)}</span>
          </div>
        ) : (
          <div className="companion-mood-state">
            <span className="companion-mood-absent">quiet</span>
          </div>
        )}
      </div>
    </Link>
  );
}
