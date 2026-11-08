// app/layout.tsx
// WHAT IT'S FOR: the "root layout": the outer frame (<html> and <body>) wrapped around every
// page in the app. Required by Next.js.
// WHO USES IT: Next.js itself, for every page.
// WHY THE NAME: "layout.tsx" is the special filename Next.js looks for; ".tsx" because it
// contains screen code.

// Metadata is the type Next.js uses for the page title and description (browser tab text).
import type { Metadata } from "next";
// Loads the shared colors and base styles (white and gray) for the whole app.
import "./globals.css";

// The tab title and description for search engines and phones.
export const metadata: Metadata = {
  title: "MyChair",
  description: "Booking and client management for barbershops.",
};

// Wraps every page. "children" is whichever page is being shown.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
