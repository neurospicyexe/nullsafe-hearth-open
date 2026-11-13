import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/shell/AppShell";
import { WriteQueueProvider } from "@/components/shell/WriteQueueProvider";
import ScrollToTop from "@/components/ScrollToTop";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";
import Atmosphere from "@/components/shell/Atmosphere";
import { STILL_KEY } from "@/lib/still";
import { TIME_BOOT } from "@/lib/time-of-day";

// Runs before first paint so a device set to Still never flashes motion. Same key as lib/still.ts.
const STILL_BOOT = `try{if(localStorage.getItem(${JSON.stringify(STILL_KEY)})==="1")document.documentElement.setAttribute("data-still","")}catch(e){}`;
// Same idea for the room tint: data-time is set before paint so a hard load does not crossfade from the default.
// Cutoffs come from lib/time-of-day.ts (TIME_BOOT); Atmosphere keeps it current afterwards.

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--h-font",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#1b1814",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Home-screen app: draw edge to edge; globals.css pads the notch and home bar via safe-area insets.
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Hearth",
  description: "Halseth system dashboard",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Hearth",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${atkinson.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: STILL_BOOT + TIME_BOOT }} />
      </head>
      <body>
        <Atmosphere />
        <div className="app-layout">
          <ScrollToTop />
          <RegisterServiceWorker />
          <WriteQueueProvider>
            <AppShell>{children}</AppShell>
          </WriteQueueProvider>
        </div>
      </body>
    </html>
  );
}
