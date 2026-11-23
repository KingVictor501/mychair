// next.config.ts
// WHAT IT'S FOR: Next.js settings for the whole app. Right now: security headers on every page
// and API response, and no "x-powered-by: Next.js" header (no need to tell attackers what we run).
//   Content-Security-Policy  the browser only loads scripts, styles, images and fonts from our own
//                            site, never plugins, and other sites can't put MyChair in a frame.
//                            This is the "without nonces" policy from the Next.js security guide:
//                            'unsafe-inline' is needed for Next.js's own inline scripts, and
//                            'unsafe-eval' only while developing (never on the live site).
//   X-Content-Type-Options   the browser trusts the file type we send (no guessing a photo is a script)
//   Referrer-Policy          other sites only see our domain, never a full address with IDs in it
//   X-Frame-Options          an older way of saying "don't put this site in a frame"
//   Permissions-Policy       the site never asks for the camera, microphone or location
// (Strict-Transport-Security, "always use HTTPS", is added by Vercel already.)
// WHO USES IT: Next.js reads it when building and serving the app.
// WHY THE NAME: Next.js looks for "next.config"; ".ts" because the project is TypeScript.

import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
