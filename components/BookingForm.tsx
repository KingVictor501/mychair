// components/BookingForm.tsx
// WHAT IT'S FOR: the booking steps on a pro's page: pick a service, pick a day, pick an open
// time (loaded from GET /api/pros/<id>/slots), then confirm (POST /api/appointments).
// The cancellation window is shown before confirming. Loading, empty, error and success are
// all shown.
// WHO USES IT: app/book/[proId]/page.tsx (a client booking), app/pro/book/[clientId]/page.tsx
// (a pro booking a client who called in, using the bookFor prop), and app/guest/[proId]/page.tsx
// (booking without an account, using the guest prop: asks for first name and phone, and uses the
// public /api/guest/* routes).
// WHY THE NAME: the booking form; ".tsx" = screen code.

"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProService } from "@/lib/booking/data";
import type { Slot } from "@/lib/booking/slots";
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
};
type SlotState = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; slots: Slot[] };
type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "done" } | { kind: "error"; message: string };

// The look of a chosen option, so the selected service, day and time stand out.
const selected = (on: boolean) => (on ? "!bg-text !text-bg" : "");

export default function BookingForm({ proId, services, dates, timeZone, cancellationWindowHours, bookFor, guest = false }: Props) {
  const [service, setService] = useState<ProService | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotState>({ kind: "idle" });
  const [chosen, setChosen] = useState<Slot | null>(null);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  // A guest's first name and phone (only used when "guest" is set).
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  // Loads the open times for a service on a day.
  async function loadSlots(nextService: ProService, nextDate: string) {
    setChosen(null);
    setSlots({ kind: "loading" });
    try {
      const base = guest ? "/api/guest/pros" : "/api/pros";
      const res = await fetch(`${base}/${proId}/slots?date=${nextDate}&serviceId=${nextService.id}`);
      const body = (await res.json()) as { slots?: Slot[]; error?: { message: string } };
      if (!res.ok || !body.slots) return setSlots({ kind: "error", message: body.error?.message ?? "Couldn't load times." });
      setSlots({ kind: "ready", slots: body.slots });
    } catch {
      setSlots({ kind: "error", message: "Couldn't reach the server. Try again." });
    }
  }

  // Books the chosen time. If someone took it first, the times reload.
  async function confirm() {
    if (!service || !chosen) return;
    setSave({ kind: "saving" });
    try {
      const url = guest ? "/api/guest/appointments" : bookFor ? "/api/pro/appointments" : "/api/appointments";
      const payload = guest
        ? { proId, serviceId: service.id, startsAt: chosen.startsAt, name: guestName, phone: guestPhone }
        : bookFor
          ? { clientId: bookFor.clientId, proId, serviceId: service.id, startsAt: chosen.startsAt }
          : { proId, serviceId: service.id, startsAt: chosen.startsAt };
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        setSave({ kind: "error", message: body.error?.message ?? "Couldn't book. Try another time." });
        if (date) void loadSlots(service, date);
        return;
      }
      setSave({ kind: "done" });
    } catch {
      setSave({ kind: "error", message: "Couldn't reach the server. Try again." });
    }
  }

  if (save.kind === "done" && service && chosen) {
    return (
      <div role="status" className="rounded-lg border border-border bg-surface p-4">
        <p className="!mt-0 font-semibold text-text">{bookFor ? `${bookFor.clientName} is booked.` : guest ? `You're booked, ${guestName}.` : "You're booked."}</p>
        <p>
          {service.name} on {shopDateTime(chosen.startsAt, timeZone)}.
        </p>
        {guest && <p>To change or cancel, call the shop.</p>}
        {guest ? (
          <Link href="/guest">Book another appointment</Link>
        ) : (
          <Link href={bookFor ? "/pro" : "/book/mine"}>{bookFor ? "Back to my schedule" : "See my appointments"}</Link>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h2>1. Service</h2>
        {services.length === 0 ? (
          <p>This pro has no services listed yet.</p>
        ) : (
          <div className="grid gap-2">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={service?.id === s.id}
                onClick={() => {
                  setService(s);
                  if (date) void loadSlots(s, date);
                }}
                className={`!flex !justify-between !text-left gap-3 ${selected(service?.id === s.id)}`}
              >
                <span>
                  <span className="block font-semibold">{s.name}</span>
                  <span className="block text-xs opacity-80">{s.description}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block">{money(s.priceCents)}</span>
                  <span className="block text-xs opacity-80">{s.durationMin} min</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {service && (
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
                  void loadSlots(service, d);
                }}
                className={selected(date === d)}
              >
                {dayLabel(d)}
              </button>
            ))}
          </div>
        </section>
      )}

      {service && date && (
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

      {service && chosen && (
        <section className="rounded-lg border border-border bg-surface p-4">
          <p className="!mt-0">
            <strong className="text-text">{service.name}</strong> · {shopDateTime(chosen.startsAt, timeZone)} · {money(service.priceCents)}
          </p>
          {guest ? (
            <>
              <p className="text-sm">Without an account, call the shop to change or cancel, up to {cancellationWindowHours} hours before.</p>
              <div className="mb-3 grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span>First name</span>
                  <input value={guestName} onChange={(e) => setGuestName(e.target.value)} maxLength={40} autoComplete="given-name" required />
                </label>
                <label className="flex flex-col gap-1">
                  <span>Phone number</span>
                  <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="(212) 555-0111" required />
                </label>
              </div>
            </>
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
          <button type="button" onClick={() => void confirm()} disabled={save.kind === "saving" || (guest && (!guestName.trim() || !guestPhone.trim()))}>
            {save.kind === "saving" ? "Booking…" : "Confirm booking"}
          </button>
        </section>
      )}
    </div>
  );
}
