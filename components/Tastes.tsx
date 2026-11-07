"use client";

import { useState } from "react";
import { Icon } from "./icons";
import { ADVENTURE_OPTIONS, DIET_EXTRAS, DIET_OPTIONS, EMPTY_TASTES, NEVER_OPTIONS, TIME_OPTIONS, hasTastes, type Tastes } from "@/lib/tastes";

const STEPS = ["WHO’S EATING?", "YOUR DIET", "NEVER GIVE US…", "WEEKNIGHT TIME", "HOW ADVENTUROUS?", "ANYTHING ELSE?"];

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="stepper">
      <span className="mname">{label}</span>
      <div className="stepper-ctl">
        <button type="button" className="iconbtn" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>–</button>
        <span className="stepper-n" aria-live="polite">{value}</span>
        <button type="button" className="iconbtn" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}><Icon.plus size={18} /></button>
      </div>
    </div>
  );
}

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} className={on ? "fchip on" : "fchip"} onClick={onClick}>
      {on && <Icon.tick size={14} />} {children}
    </button>
  );
}

export function TastesFlow({
  initial,
  busy,
  onSave,
  onSkip,
  onClose,
}: {
  initial: Tastes | null;
  busy: boolean;
  onSave: (t: Tastes) => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const [t, setT] = useState<Tastes>(hasTastes(initial) ? initial : EMPTY_TASTES);
  const [step, setStep] = useState(0);
  const [own, setOwn] = useState("");
  const last = step === STEPS.length - 1;
  const firstTime = !hasTastes(initial);

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const addOwn = () => {
    const v = own.trim();
    if (v && !t.never.some((n) => n.toLowerCase() === v.toLowerCase())) setT({ ...t, never: [...t.never, v] });
    setOwn("");
  };
  const neverChoices = [...NEVER_OPTIONS, ...t.never.filter((n) => !NEVER_OPTIONS.includes(n))];

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Our tastes" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet-body tastes">
        <div className="toprow">
          <span className="lbl" style={{ color: "var(--rasp)" }}>OUR TASTES · {step + 1} OF {STEPS.length}</span>
          <button type="button" className="iconbtn" aria-label="Close" onClick={onClose}><Icon.x /></button>
        </div>
        <div className="dots" aria-hidden="true">{STEPS.map((_, i) => <span key={i} className={i <= step ? "on" : ""} />)}</div>
        <h2 className="h1" style={{ fontSize: 28 }}>{STEPS[step]}</h2>

        {step === 0 && (
          <>
            <p className="muted">So portions and ideas suit everyone at the table.</p>
            <Stepper label="Adults" value={t.adults} min={1} max={8} onChange={(n) => setT({ ...t, adults: n })} />
            <Stepper
              label="Kids"
              value={t.kidAges.length}
              min={0}
              max={6}
              onChange={(n) => setT({ ...t, kidAges: n > t.kidAges.length ? [...t.kidAges, 4] : t.kidAges.slice(0, n) })}
            />
            {t.kidAges.map((age, i) => (
              <label key={i} className="stepper">
                <span className="small" style={{ fontWeight: 600 }}>Child {i + 1}’s age</span>
                <select className="select" value={age} onChange={(e) => setT({ ...t, kidAges: t.kidAges.map((a, j) => (j === i ? Number(e.target.value) : a)) })}>
                  {Array.from({ length: 18 }, (_, a) => <option key={a} value={a}>{a === 0 ? "Under 1" : a}</option>)}
                </select>
              </label>
            ))}
          </>
        )}

        {step === 1 && (
          <>
            <div className="optlist">
              {DIET_OPTIONS.map((d) => (
                <button key={d.value} type="button" aria-pressed={t.diet === d.value} className={t.diet === d.value ? "opt on" : "opt"} onClick={() => setT({ ...t, diet: d.value })}>
                  <span className="radio" />{d.label}
                </button>
              ))}
            </div>
            <span className="lbl" style={{ marginTop: 6 }}>ANYTHING ELSE TO STICK TO?</span>
            <div className="tagpick">
              {DIET_EXTRAS.map((x) => <Chip key={x} on={t.dietExtras.includes(x)} onClick={() => setT({ ...t, dietExtras: toggle(t.dietExtras, x) })}>{x}</Chip>)}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="muted">Tap anything you don’t want to see in your ideas.</p>
            <div className="tagpick">
              {neverChoices.map((x) => <Chip key={x} on={t.never.includes(x)} onClick={() => setT({ ...t, never: toggle(t.never, x) })}>{x}</Chip>)}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <label htmlFor="ownnever" className="sr">Add your own</label>
              <input
                id="ownnever"
                className="input"
                placeholder="Add your own, e.g. celery"
                value={own}
                enterKeyHint="done"
                onChange={(e) => setOwn(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOwn(); } }}
              />
              <button type="button" className="round small" aria-label="Add" onClick={addOwn}><Icon.plus /></button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <p className="muted">How long do you usually have to cook on a weeknight?</p>
            <div className="optlist">
              {TIME_OPTIONS.map((o) => (
                <button key={o.value} type="button" aria-pressed={t.time === o.value} className={t.time === o.value ? "opt on" : "opt"} onClick={() => setT({ ...t, time: o.value })}>
                  <span className="radio" />
                  <span className="col"><span>{o.label}</span><span className="small" style={{ fontWeight: 500, color: "var(--muted)" }}>{o.hint}</span></span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <p className="muted">How new and different should the ideas be?</p>
            <div className="optlist">
              {ADVENTURE_OPTIONS.map((o) => (
                <button key={o.value} type="button" aria-pressed={(t.adventure ?? "mix") === o.value} className={(t.adventure ?? "mix") === o.value ? "opt on" : "opt"} onClick={() => setT({ ...t, adventure: o.value })}>
                  <span className="radio" />
                  <span className="col"><span>{o.label}</span><span className="small" style={{ fontWeight: 500, color: "var(--muted)" }}>{o.hint}</span></span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <p className="muted">Optional. Anything that helps us suggest the right food.</p>
            <label htmlFor="tnotes" className="sr">Anything else</label>
            <textarea id="tnotes" className="field" maxLength={500} value={t.notes} onChange={(e) => setT({ ...t, notes: e.target.value })} placeholder="e.g. We’ve got a newborn, so freezer-friendly meals are a big help. We love Middle Eastern food." />
          </>
        )}

        <div className="btnrow" style={{ marginTop: 8, flexWrap: "nowrap" }}>
          {step > 0 && <button type="button" className="btn btn-line" onClick={() => setStep(step - 1)}>BACK</button>}
          <button
            type="button"
            className="btn btn-rasp btn-big"
            style={{ flex: 1, width: "auto" }}
            disabled={busy}
            onClick={() => (last ? onSave(t) : setStep(step + 1))}
          >
            {last ? (busy ? "SAVING…" : "SAVE OUR TASTES") : "NEXT"}
          </button>
        </div>
        {firstTime && <button type="button" className="btn-text" onClick={onSkip}>SKIP FOR NOW</button>}
      </div>
    </div>
  );
}
