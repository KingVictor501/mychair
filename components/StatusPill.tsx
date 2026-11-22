// components/StatusPill.tsx
// WHAT IT'S FOR: a small rounded label for an appointment's status (Waiting, In chair, Completed,
// No-show, Cancelled), so status is easy to spot in a list. Words, not just color.
// WHO USES IT: the pro, owner and client appointment lists, and the visit history.
// WHY THE NAME: a "pill" is the usual name for a small rounded label; ".tsx" = screen code.

import { APPOINTMENT_STATUS } from "@/lib/format";

// Finished and active statuses stand out; cancelled and no-show are quieter.
const STYLE: Record<string, string> = {
  waiting: "border-border bg-bg text-text",
  in_chair: "border-text bg-text text-bg",
  completed: "border-border bg-surface text-text",
  no_show: "border-border bg-bg text-text-muted line-through",
  cancelled: "border-border bg-bg text-text-muted line-through",
};

export default function StatusPill({ status }: { status: string }) {
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${STYLE[status] ?? STYLE.waiting}`}>{APPOINTMENT_STATUS[status] ?? status}</span>;
}
