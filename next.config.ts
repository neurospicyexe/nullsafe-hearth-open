import type { NextConfig } from "next";

// Library uploads PUT the book straight to Halseth (lib/library-upload.ts), so the browser must be
// allowed to connect to that one origin. Build-time, same input as images.remotePatterns below.
const halsethOrigin = (() => {
  try { return process.env.HALSETH_URL ? new URL(process.env.HALSETH_URL).origin : null; }
  catch { return null; }
})();

const nextConfig: NextConfig = {
  // The old Today and Check-in pages live on Home now (spoons strip + check-in sheet).
  async redirects() {
    return [
      { source: "/today", destination: "/", permanent: false },
      { source: "/checkin", destination: "/", permanent: false },
      // Questions are one kind of "needs you" now.
      { source: "/questions", destination: "/needs", permanent: false },
      // Handovers are listed with sessions now.
      { source: "/handovers", destination: "/sessions", permanent: false },
      // Duplicates and shadowed pages (P6): one source each.
      { source: "/deltas", destination: "/feelings", permanent: false },
      { source: "/phoenix/dreams", destination: "/dreams", permanent: false },
      { source: "/uplink", destination: "/", permanent: false },
      // The old constellation page already redirected in-page; the redirect lives here now.
      { source: "/graph", destination: "/map", permanent: false },
      // Under the hood is the cellar now (nav 1b).
      { source: "/hood", destination: "/archive", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        // The two make-frame routes (B62) set their own CSP and may be framed by Hearth itself;
        // everything else keeps the strict global policy below.
        source: "/((?!api/makes/player$|api/makes/page$).*)",
        headers: [
          { key: "X-Frame-Options",       value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",     value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              // blob: is epub.js -- it unzips the book in-browser and serves every
              // internal image (and sometimes the chapter iframe itself) as a blob URL.
              // Without it the reader renders text but every illustration is blocked.
              "img-src 'self' data: blob: https:",
              "frame-src 'self' blob:",
              "font-src 'self' https://fonts.gstatic.com",
              `connect-src 'self' https://vercel.live wss://ws-us3.pusher.com${halsethOrigin ? ` ${halsethOrigin}` : ""}`,
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: new URL(process.env.HALSETH_URL ?? "https://localhost").hostname,
      },
    ],
  },
};

export default nextConfig;
