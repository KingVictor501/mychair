// app/page.tsx
// WHAT IT'S FOR: the home page, at the site's root address ("/"). A visitor can book without an
// account. "Create an account" is shown but not available yet. People who already have an
// account (clients, pros, owners) use "Log in".
// WHO USES IT: everyone. Next.js shows it when someone visits the site.
// WHY THE NAME: in the App Router, a file named "page.tsx" is the page for its folder;
// this one sits directly in "app", so it is the home page.

import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";

export default function HomePage() {
  return (
    <main className="!max-w-md">
      <Breadcrumbs items={[{ label: "Home" }]} />
      <h1 className="!mb-1">MyChair</h1>
      <p className="!mt-0">Book your next appointment in a few taps.</p>
      <div className="mt-6 grid gap-3">
        <Link href="/guest" className="block rounded-lg border border-border !bg-text px-4 py-3 text-center font-semibold !text-bg !no-underline">
          Book without an account
        </Link>
        {/* Not available yet: accounts will let clients choose their shop and a preferred pro. */}
        <button type="button" disabled aria-describedby="account-soon" className="w-full">
          Create an account
        </button>
        <p id="account-soon" className="!my-0 text-center text-sm">
          Coming soon. An account lets you choose your shop and a preferred pro.
        </p>
      </div>
      <p className="mt-8 text-center text-sm">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </main>
  );
}
