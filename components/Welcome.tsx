"use client";

import { useRef, useState } from "react";
import { Icon, shapeFor } from "./icons";

const HEART = "M26 43C14 34 8 27 8 19a9 9 0 0 1 18-3 9 9 0 0 1 18 3c0 8-6 15-18 24z";
const BASKET = "M8 20h36l-4 20a4 4 0 0 1-4 3H16a4 4 0 0 1-4-3z M17 20l7-11 M35 20l-7-11 M5 18h42v5H5z";

const CARDS: { title: string; text: string; bg: string; ink: string; art: string[] }[] = [
  {
    title: "Meal planning gets boring",
    text: "It’s easy to end up cooking the same few things every week.",
    bg: "var(--orange)",
    ink: "var(--ink)",
    art: [shapeFor("One pan weekday").d, shapeFor("One pan weekday").d, shapeFor("One pan weekday").d],
  },
  {
    title: "Save the meals you love",
    text: "Add the dinners you already know and love, so you don’t forget the good ones. Type them in or take a photo of a recipe.",
    bg: "var(--rasp)",
    ink: "var(--cream-text)",
    art: [HEART],
  },
  {
    title: "Get new ideas",
    text: "Find new meals by category or by what you fancy, based on your tastes. Save the ones you like and they become your go-tos too.",
    bg: "var(--pink)",
    ink: "var(--ink)",
    art: [shapeFor("BBQ").d],
  },
  {
    title: "Plan your week",
    text: "Pick your meals for the week and we’ll put together your shopping list.",
    bg: "var(--ink)",
    ink: "var(--cream-text)",
    art: [BASKET],
  },
];

const ART_FILL = ["var(--rasp)", "var(--orange)", "var(--cream-text)", "var(--orange)"];

export function Welcome({ lastLabel, onDone, onSkip }: { lastLabel: string; onDone: () => void; onSkip: () => void }) {
  const [i, setI] = useState(0);
  const touchX = useRef<number | null>(null);
  const c = CARDS[i];
  const last = i === CARDS.length - 1;
  const next = () => (last ? onDone() : setI(i + 1));

  return (
    <div
      className="welcome"
      role="dialog"
      aria-modal="true"
      aria-label="How MEGA works"
      style={{ background: c.bg, color: c.ink }}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (dx < -50 && !last) setI(i + 1);
        if (dx > 50 && i > 0) setI(i - 1);
      }}
    >
      <div className="toprow">
        <span className="caps" style={{ fontSize: 12 }}>HOW MEGA WORKS</span>
        <button type="button" className="btn-text" style={{ color: "inherit" }} onClick={onSkip}>SKIP</button>
      </div>
      <div className="welcome-art" aria-hidden="true">
        {c.art.map((d, k) => (
          <svg key={k} width={c.art.length > 1 ? 110 : 180} height={c.art.length > 1 ? 110 : 180} viewBox="0 0 52 52">
            <path d={d} fill={ART_FILL[i]} stroke={i === 3 ? ART_FILL[i] : "none"} strokeWidth={i === 3 ? 2.5 : 0} strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        ))}
      </div>
      <div className="welcome-copy" aria-live="polite">
        <h2 className="h1" style={{ fontSize: 34, color: "inherit" }}>{c.title}</h2>
        <p>{c.text}</p>
      </div>
      <div className="welcome-foot">
        <div className="dots" aria-hidden="true">
          {CARDS.map((_, k) => <span key={k} className={k === i ? "on" : ""} />)}
        </div>
        <div className="btnrow" style={{ flexWrap: "nowrap" }}>
          {i > 0 && (
            <button type="button" className="iconbtn welcome-back" aria-label="Back" onClick={() => setI(i - 1)}><Icon.back /></button>
          )}
          <button type="button" className="btn btn-big welcome-next" onClick={next}>{last ? lastLabel : "NEXT"}</button>
        </div>
      </div>
    </div>
  );
}
