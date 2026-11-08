// app/page.tsx
// WHAT IT'S FOR: the hello-world home page, shown at the site's root address ("/").
// WHO USES IT: Next.js itself. It shows this page when someone visits the site.
// WHY THE NAME: in the App Router, a file named "page.tsx" is the page for its folder;
// this one sits directly in "app", so it is the home page.

// HealthStatus comes from components/HealthStatus.tsx: the widget that calls /api/health.
import HealthStatus from "@/components/HealthStatus";

// This is a server component (the default): it has no "use client" because it only
// lays out static text and drops in the interactive widget.
export default function HomePage() {
  return (
    <main>
      <h1>MyChair</h1>
      <p>Hello, world. This is the MyChair skeleton.</p>
      <HealthStatus />
    </main>
  );
}
