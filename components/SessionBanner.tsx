// components/SessionBanner.tsx
// WHAT IT'S FOR: the strip across the top of every page that says when the session is special:
//   - "Viewing as Ben (owner)" with a "Stop viewing as" button, while the Super Admin uses "view as"
//   - "Demo" with made-up data, and a "Leave demo" button, for a demo account
// Normal sessions show nothing. A server component: it reads the session on the server.
// WHO USES IT: app/layout.tsx.
// WHY THE NAME: a banner about the session; ".tsx" = screen code.

import { getCurrentUser, getSessionClaims } from "@/lib/auth/current-user";
import LogoutButton from "./LogoutButton";
import SwitchSessionButton from "./SwitchSessionButton";

const ROLE_LABEL: Record<string, string> = { owner: "owner", pro: "pro", client: "client", super_admin: "Super Admin" };

export default async function SessionBanner() {
  const [user, claims] = await Promise.all([getCurrentUser(), getSessionClaims()]);
  if (!user || !claims) return null;

  if (claims.actorId) {
    return (
      <div role="status" className="flex flex-wrap items-center justify-center gap-3 border-b border-border bg-text px-4 py-2 text-sm text-bg">
        <span>
          Viewing as <strong>{user.displayName ?? user.name}</strong> ({ROLE_LABEL[user.role]}){user.isDemo ? " · demo data" : ""}. What you do here is done as them.
        </span>
        <SwitchSessionButton url="/api/admin/view-as/stop" label="Stop viewing as" className="!py-1 text-sm" />
      </div>
    );
  }

  if (user.isDemo) {
    return (
      <div role="status" className="flex flex-wrap items-center justify-center gap-3 border-b border-border bg-surface px-4 py-2 text-sm">
        <span>
          <strong className="text-text">Demo</strong> · you&apos;re seeing {user.displayName ?? user.name}&apos;s {ROLE_LABEL[user.role]} view, with made-up data.
        </span>
        <LogoutButton label="Leave demo" goTo="/demo" />
      </div>
    );
  }
  return null;
}
