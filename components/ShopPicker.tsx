// components/ShopPicker.tsx
// WHAT IT'S FOR: the predictive shop search on /guest. The guest starts typing a shop's name and
// a dropdown shows the closest matches as they type (from GET /api/guest/shops), so a few
// letters are usually enough. Tapping a match, or pressing Enter, opens that shop's pros.
// Tapping the empty box already lists shops to choose from.
// Accessible as a "combobox" (the WAI-ARIA Authoring Practices pattern): the arrow keys move
// through the matches while the typing cursor stays in the box, Escape closes the list (or
// clears the box), and a screen reader hears how many matches there are.
// WHO USES IT: app/guest/page.tsx.
// WHY THE NAME: it picks a shop; ".tsx" = screen code. "use client" because it reacts to typing.

"use client";

// useRouter (Next.js) opens the chosen shop's page without a full reload.
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import type { GuestShopChoice } from "@/lib/guest/booking";
import { BUSINESS_TYPE } from "@/lib/format";
import { shopTheme } from "@/lib/theme";

// "forText" is what was typed when these matches were found, so a late answer is never used for newer typing.
type State = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; shops: GuestShopChoice[]; forText: string };

// How long to wait after a key press before asking the server, so fast typing sends one request.
const PAUSE_MS = 120;

export default function ShopPicker() {
  const router = useRouter();
  const listId = useId();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ kind: "loading" });
  // Which match the arrow keys are on (-1 = none, the cursor is just in the box).
  const [active, setActive] = useState(-1);
  const [going, setGoing] = useState<string | null>(null);
  // Set when Enter is pressed before the matches for the latest typing have arrived: the closest
  // match is opened as soon as they do, so a fast typist never lands on the wrong shop.
  const [enterWaiting, setEnterWaiting] = useState(false);

  // Ask for matches whenever the text changes (after a short pause). An older answer that
  // arrives late is thrown away ("cancelled"), so the list always matches what's in the box.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/guest/shops?q=${encodeURIComponent(text.trim())}`, { signal: controller.signal });
        const body = (await res.json()) as { shops?: GuestShopChoice[]; error?: { message: string } };
        if (!res.ok || !body.shops) return setState({ kind: "error", message: body.error?.message ?? "Couldn't search shops. Try again." });
        setState({ kind: "ready", shops: body.shops, forText: text.trim() });
        setActive(-1);
      } catch {
        // A cancelled request isn't an error; anything else is.
        if (!controller.signal.aborted) setState({ kind: "error", message: "Couldn't reach the server. Try again." });
      }
    }, PAUSE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text]);

  const shops = state.kind === "ready" ? state.shops : [];
  // True when the matches on screen are for exactly what's in the box now.
  const fresh = state.kind === "ready" && state.forText === text.trim();

  // Enter was pressed early: open the closest match once the fresh matches arrive.
  useEffect(() => {
    if (!enterWaiting || !fresh) return;
    setEnterWaiting(false);
    if (shops[0]) choose(shops[0]);
    // Only when fresh matches arrive.
  }, [enterWaiting, fresh]);
  const optionId = (i: number) => `${listId}-option-${i}`;

  // Opens a shop's page. The chosen name stays in the box while the page loads.
  function choose(shop: GuestShopChoice) {
    setText(shop.name);
    setOpen(false);
    setGoing(shop.slug);
    router.push(`/guest/shop/${shop.slug}`);
  }

  // The keyboard rules from the combobox pattern (focus never leaves the box).
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      if (shops.length === 0) return;
      // Down from the last match goes back to the first, and up from the first to the last.
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i < 0 ? (step === 1 ? 0 : shops.length - 1) : (i + step + shops.length) % shops.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Enter opens the highlighted match, or the closest one, so the guest never has to finish typing.
      if (!fresh) return setEnterWaiting(true);
      const pick = shops[active] ?? shops[0];
      if (pick) choose(pick);
    } else if (e.key === "Escape") {
      if (open) setOpen(false);
      else setText("");
      setActive(-1);
    }
  }

  return (
    <div className="relative">
      <label htmlFor={`${listId}-input`} className="mb-1 block font-semibold text-text">
        Shop name
      </label>
      <input
        id={`${listId}-input`}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        enterKeyHint="go"
        placeholder="Start typing, e.g. Fade"
        value={text}
        maxLength={80}
        autoFocus
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setEnterWaiting(false);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="w-full !text-lg"
      />

      {/* Tells a screen reader how many matches there are, without moving focus. */}
      <p className="sr-only" aria-live="polite">
        {open && state.kind === "ready" ? `${shops.length} ${shops.length === 1 ? "shop" : "shops"} found` : ""}
      </p>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border bg-bg shadow-lg">
          {state.kind === "loading" && <div aria-busy className="m-2 h-10 animate-pulse rounded bg-surface" />}
          {state.kind === "error" && (
            <p role="alert" className="!m-0 px-3 py-3 text-sm">
              {state.message}
            </p>
          )}
          {state.kind === "ready" && shops.length === 0 && (
            <p className="!m-0 px-3 py-3 text-sm">No shops match “{text.trim()}”. Check the spelling, or try fewer letters.</p>
          )}
          <ul id={listId} role="listbox" aria-label="Matching shops" className="!m-0 !list-none !p-0">
            {shops.map((shop, i) => (
              <li
                key={shop.slug}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                data-shop={shopTheme(shop.businessType)}
                // mousedown (not click) with preventDefault, so the box keeps focus and the list
                // doesn't close before the tap lands.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(shop);
                }}
                onMouseMove={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-3 px-3 py-3 ${i === active ? "bg-surface" : ""}`}
              >
                <span aria-hidden className="shop-gradient h-8 w-8 shrink-0 rounded-full border border-border" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-text">{shop.name}</span>
                  <span className="block text-xs text-text-muted">{BUSINESS_TYPE[shop.businessType] ?? shop.businessType}</span>
                </span>
                {going === shop.slug && <span className="ml-auto text-xs text-text-muted">Opening…</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {going && !open && <p className="!mb-0 mt-2 text-sm text-text-muted" role="status">Opening the shop…</p>}
    </div>
  );
}
