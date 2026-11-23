// app/guest/page.tsx
// WHAT IT'S FOR: "Book without an account", at /guest. Step 1 of guest booking: find the shop by
// typing its name (a predictive search shows the closest matches as you type). Choosing a shop
// opens its pros at /guest/shop/<shop link name>. No login needed. Demo shops show only while
// demo mode is on.
// WHO USES IT: anyone, from the "Book without an account" button on the home page.
// WHY THE NAME: folder path = URL (/guest).

import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import ShopPicker from "@/components/ShopPicker";

export const metadata: Metadata = { title: "Book without an account · MyChair" };

export default function GuestPage() {
  return (
    <main>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Book without an account" }]} />
      <h1 className="!mt-2 !mb-1">Book an appointment</h1>
      <p className="!mt-0">No account needed. Find your shop, pick a pro and a time, and you&apos;re booked.</p>
      <div className="mt-4 max-w-xl">
        <ShopPicker />
      </div>
    </main>
  );
}
