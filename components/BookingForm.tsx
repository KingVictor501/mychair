// components/BookingForm.tsx
// WHAT IT'S FOR: the booking steps on a pro's page: pick one or more services (up to 4, done
// back to back in one visit), pick a day, pick an open time for the whole visit (loaded from
// GET /api/pros/<id>/slots), then confirm (POST /api/appointments).
// The cancellation window is shown before confirming. Loading, empty, error and success are
// all shown.
// To keep it quick: after the first service is picked, it jumps to the first day that has open
// times, and after a time is picked it scrolls to the last step (for a guest, straight into the
// first-name box). A guest can press Enter to confirm.
// WHO USES IT: app/book/[proId]/page.tsx (a client booking), app/pro/book/[clientId]/page.tsx
// (a pro booking a client who called in, using the bookFor prop), and app/guest/[proId]/page.tsx
// (booking without an account, using the guest prop: asks for first name and phone, and uses the
// public /api/guest/* routes).
// WHY THE NAME: the booking form; ".tsx" = screen code.

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ProService } from "@/lib/booking/data";
import type { Slot } from "@/lib/booking/slots";
import { MAX_SERVICES } from "@/lib/booking/slots";
import { dayLabel, money, shopDateTime, shopTime } from "@/lib/format";

type Props = {
  proId: string;
  services: ProService[];
  dates: string[];
  timeZone: string;
  cancellationWindowHours: number;
  // Set when a pro books on a client's behalf (a client who called in). The booking then goes to
  // POST /api/pro/appointments for that client (with the pro in "proId", who may be another pro
  // who allows it) instead of the logged-in client's own booking.
  bookFor?: { clientId: string; clientName: string };
  // Set when someone books without an account.
  guest?: boolean;
  // For a guest: where "Book another appointment" goes (their shop's page).
  guestBackHref?: string;
};
type SlotState = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; slots: Slot[] };
type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "done" } | { kind: "error"; message: string };

// The look of an option: outlined when not chosen, filled in when chosen, so the picked service,
// day and time stand out at a glance.
const selected = (on: boolean) => (on ? "!bg-text !text-bg" : "!bg-bg !text-text !border-border");

export default function BookingForm({ proId, services, dates, timeZone, cancellationWindowHours, bookFor, guest = false, guestBackHref = "/guest" }: Props) {
  // The services picked, in the order picked. Their lengths and prices add up.
  const [picked, setPicked] = useState<ProService[]>([]);
  const totalMin = picked.reduce((sum, s) => sum + s.durationMin, 0);
  const totalCents = picked.reduce((sum, s) => sum + s.priceCents, 0);
  const pickedNames = picked.map((s) => s.name).join(" + ");
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotState>({ kind: "idle" });
  const [chosen, setChosen] = useState<Slot | null>(null);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  // A guest's first name and phone (only used when "guest" is set).
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  // The last step and the first-name box, so picking a time can bring them into view.
  const confirmRef = useRef<HTMLElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // When a time is picked, scroll the confirm step into view (and, for a guest, put the cursor
  // in the first-name box if it's still empty).
  useEffect(() => {
    if (!chosen) return;
    confirmRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (guest && !guestName) nameRef.current?.focus({ preventScroll: true });
    // Only when the picked time changes, not on every letter typed.
  }, [chosen]);

  // Asks for the open times on one day. Returns them, or an error message.
  async function fetchSlots(nextPicked: ProService[], day: string): Promise<{ slots: Slot[] } | { message: string }> {
    const base = guest ? "/api/guest/pros" : "/api/pros";
    const ids = nextPicked.map((s) => s.id).join(",");
    const res = await fetch(`${base}/${proId}/slots?date=${day}&serviceIds=${ids}`);
    const body = (await res.json()) as { slots?: Slot[]; error?: { message: string } };
    if (!res.ok || !body.slots) return { message: body.error?.message ?? "Couldn't load times." };
    return { slots: body.slots };
  }

  // After the first service is picked: go through the days in order and stop at the first one
  // with an open time, so the guest sees times right away instead of trying day after day.
  async function jumpToFirstOpenDay(nextPicked: ProService[]) {
    setChosen(null);
    setSlots({ kind: "loading" });
    setDate(dates[0] ?? null);
    try {
      for (const day of dates) {
        const result = await fetchSlots(nextPicked, day);
        if ("message" in result) return setSlots({ kind: "error", message: result.message });
        if (result.slots.length > 0) {
          setDate(day);
          return setSlots({ kind: "ready", slots: result.slots });
        }
      }
      // No open times on any day: show the first day's empty state.
      setDate(dates[0] ?? null);
      setSlots({ kind: "ready", slots: [] });
    } catch {
      setSlots({ kind: "error", message: "Couldn't reach the server. Try again." });
    }
  }

  // Loads the open times on a day for the picked services, back to back.
  async function loadSlots(nextPicked: ProService[], nextDate: string) {
    setChosen(null);
    setSlots({ kind: "loading" });
    try {
      const result = await fetchSlots(nextPicked, nextDate);
      if ("message" in result) return setSlots({ kind: "error", message: result.message });
      setSlots({ kind: "ready", slots: result.slots });
    } catch {
      setSlots({ kind: "error", message: "Couldn't reach the server. Try again." });
    }
  }

  // Books the chosen time. If someone took it first, the times reload.
  async function confirm() {
    if (picked.length === 0 || !chosen) return;
    setSave({ kind: "saving" });
    try {
      const serviceIds = picked.map((s) => s.id);
      const url = guest ? "/api/guest/appointments" : bookFor ? "/api/pro/appointments" : "/api/appointments";
      const payload = guest
        ? { proId, serviceIds, startsAt: chosen.startsAt, name: guestName, phone: guestPhone }
        : bookFor
          ? { clientId: bookFor.clientId, proId, serviceIds, startsAt: chosen.startsAt }
          : { proId, serviceIds, startsAt: chosen.startsAt };
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        setSave({ kind: "error", message: body.error?.message ?? "Couldn't book. Try another time." });
        if (date) void loadSlots(picked, date);
        return;
      }
      setSave({ kind: "done" });
    } catch {
      setSave({ kind: "error", message: "Couldn't reach the server. Try again." });
    }
  }

  if (save.kind === "done" && picked.length > 0 && chosen) {
    return (
      <div role="status" className="rounded-lg border border-border bg-surface p-4">
        <p className="!mt-0 font-semibold text-text">{bookFor ? `${bookFor.clientName} is booked.` : guest ? `You're booked, ${guestName}.` : "You're booked."}</p>
        <p>
          {pickedNames} on {shopDateTime(chosen.startsAt, timeZone)}.
        </p>
        {guest && <p>To change or cancel, call the shop.</p>}
        {guest ? (
          <Link href={guestBackHref}>Book another appointment</Link>
        ) : (
          <Link href={bookFor ? "/pro" : "/book/mine"}>{bookFor ? "Back to my schedule" : "See my appointments"}</Link>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h2>1. Services</h2>
        <p className="!mt-0 text-sm">Pick one or more (up to {MAX_SERVICES}). They&apos;re done back to back in one visit.</p>
        {services.length === 0 ? (
          <p>This pro has no services listed yet.</p>
        ) : (
          <div className="grid gap-2">
            {services.map((s) => {
              const on = picked.some((p) => p.id === s.id);
              const full = !on && picked.length >= MAX_SERVICES;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  disabled={full}
                  onClick={() => {
                    // Tap to add, tap again to remove. Times reload for the new total length.
                    const next = on ? picked.filter((p) => p.id !== s.id) : [...picked, s];
                    setPicked(next);
                    if (next.length === 0) {
                      setChosen(null);
                      setSlots({ kind: "idle" });
                    } else if (date) void loadSlots(next, date);
                    else void jumpToFirstOpenDay(next);
                  }}
                  className={`!flex !justify-between !text-left gap-3 ${selected(on)}`}
                >
                  <span>
                    <span className="block font-semibold">
                      {on ? "✓ " : ""}
                      {s.name}
                    </span>
                    <span className="block text-xs opacity-80">{s.description}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block">{money(s.priceCents)}</span>
                    <span className="block text-xs opacity-80">{s.durationMin} min</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {picked.length > 0 && (
          <p className="!mb-0 text-sm text-text" aria-live="polite">
            {picked.length} {picked.length === 1 ? "service" : "services"} · {totalMin} min · {money(totalCents)}
          </p>
        )}
      </section>

      {picked.length > 0 && (
        <section>
          <h2>2. Day</h2>
          <div className="flex flex-wrap gap-2">
            {dates.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={date === d}
                onClick={() => {
                  setDate(d);
                  void loadSlots(picked, d);
                }}
                className={selected(date === d)}
              >
                {dayLabel(d)}
              </button>
            ))}
          </div>
        </section>
      )}

      {picked.length > 0 && date && (
        <section>
          <h2>3. Time</h2>
          {slots.kind === "loading" && <div aria-busy className="h-12 animate-pulse rounded bg-surface" />}
          {slots.kind === "error" && <p role="alert">{slots.message}</p>}
          {slots.kind === "ready" && slots.slots.length === 0 && <p>No open times that day. Try another day.</p>}
          {slots.kind === "ready" && slots.slots.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {slots.slots.map((s) => (
                <button key={s.startsAt} type="button" aria-pressed={chosen?.startsAt === s.startsAt} onClick={() => setChosen(s)} className={selected(chosen?.startsAt === s.startsAt)}>
                  {shopTime(s.startsAt, timeZone)}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {picked.length > 0 && chosen && (
        <section ref={confirmRef} className="rounded-lg border border-border bg-surface p-4">
          <h2 className="!mt-0">4. Confirm</h2>
          <p className="!mt-0">
            <strong className="text-text">{pickedNames}</strong> · {shopDateTime(chosen.startsAt, timeZone)} · {totalMin} min · {money(totalCents)}
          </p>
          {guest ? (
            // A form, so pressing Enter (or "Go" on a phone keyboard) books.
            <form
              id="guest-details"
              onSubmit={(e) => {
                e.preventDefault();
                void confirm();
              }}
            >
              <p className="text-sm">Without an account, call the shop to change or cancel, up to {cancellationWindowHours} hours before.</p>
              <div className="mb-3 grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span>First name</span>
                  <input ref={nameRef} value={guestName} onChange={(e) => setGuestName(e.target.value)} maxLength={40} autoComplete="given-name" autoCapitalize="words" enterKeyHint="next" required />
                </label>
                <label className="flex flex-col gap-1">
                  <span>Phone number</span>
                  <input type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} inputMode="tel" autoComplete="tel" enterKeyHint="go" placeholder="(212) 555-0111" maxLength={30} required />
                </label>
              </div>
            </form>
          ) : (
            <p className="text-sm">
              {bookFor ? `${bookFor.clientName} can cancel` : "You can cancel"} up to {cancellationWindowHours} hours before the appointment.
            </p>
          )}
          {save.kind === "error" && (
            <p role="alert" className="text-text">
              {save.message}
            </p>
          )}
          <button
            // For a guest this is the form's submit button; otherwise a plain button.
            type={guest ? "submit" : "button"}
            form={guest ? "guest-details" : undefined}
            onClick={guest ? undefined : () => void confirm()}
            disabled={save.kind === "saving" || (guest && (!guestName.trim() || !guestPhone.trim()))}>
            {save.kind === "saving" ? "Booking…" : "Confirm booking"}
          </button>
        </section>
      )}
    </div>
  );
}
