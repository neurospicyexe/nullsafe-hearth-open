import { renderAppIcon } from "@/lib/app-icon";

// 180x180 is iOS's native apple-touch-icon size; iOS rounds the corners itself.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderAppIcon(180, 0.14);
}
