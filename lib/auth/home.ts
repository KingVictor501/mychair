// lib/auth/home.ts
// WHAT IT'S FOR: where each role's home page is ("/pro" for a pro, and so on). Used after login
// and whenever a page sends someone who doesn't belong there to their own home.
// WHO USES IT: components/LoginForm.tsx (in the browser) and the server pages under app/.
// WHY THE NAME: home pages by role; ".ts" = no screen code. It lives here, not in LoginForm, because
// LoginForm only runs in the browser: server pages that read a value from it get nothing back
// (that sent people to "/undefined").

import type { Role } from "../types";

export const HOME_FOR_ROLE: Record<Role, string> = {
  super_admin: "/admin",
  owner: "/owner",
  pro: "/pro",
  client: "/book",
};
