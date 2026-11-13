// GET /pwa-icon/192 | /pwa-icon/512 | /pwa-icon/maskable -- manifest icons (2026-10-27).
// Public (middleware matcher): no data, and the install flow fetches them without the session.
import { renderAppIcon } from "@/lib/app-icon";

const VARIANTS: Record<string, { size: number; inset: number }> = {
  "192": { size: 192, inset: 0.14 },
  "512": { size: 512, inset: 0.14 },
  // Maskable: the platform crops to its own shape, so the mark sits inside the central 80% safe zone.
  maskable: { size: 512, inset: 0.24 },
};

export async function GET(_req: Request, { params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params;
  const v = VARIANTS[variant];
  if (!v) return new Response("not found", { status: 404 });
  const res = renderAppIcon(v.size, v.inset);
  res.headers.set("Cache-Control", "public, max-age=86400");
  return res;
}
