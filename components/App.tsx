"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppState, Idea, Meal, PhotoResult } from "@/lib/types";
import { addDays, daysBetween, lastMadeText, longLabel, shortDay, todayISO, weekRange } from "@/lib/dates";
import { Icon, LoginArt, Thumb, shapeFor, tileClass } from "./icons";

type Screen = "home" | "meals" | "meal" | "inspo" | "basket" | "plan" | "shop";
type Auth = "loading" | "out" | "in";
type Draft = {
  id?: string;
  name: string;
  tags: string[];
  ingredients: string;
  obie: "Lunch" | "Dinner";
  photoUrl: string | null;
  addToWeek: boolean;
};

const OBIE = "Obie meals";
const MOODS = ["Spicy", "BBQ", "Quick", "Cosy", "Healthy", "Fancy"];

function key(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
function starsText(n: number) {
  return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
}

async function resizeImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Couldn't open that image"));
      i.src = url;
    });
    const max = 1600;
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const THINKING = ["Raiding the cookbooks…", "Checking what’s in season…", "Picking things that work on a busy week…", "Avoiding anything you’ve said no to…", "Plating up some ideas…"];

function Thinking() {
  const [i, setI] = useState(0);
  const [secs, setSecs] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setInterval(() => setSecs((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (secs > 0 && secs % 3 === 0) setI((n) => (n + 1) % THINKING.length);
  }, [secs]);
  return (
    <div ref={ref} className="loading" role="status" aria-live="polite">
      <svg className="spin" width="56" height="56" viewBox="0 0 52 52" aria-hidden="true">
        <circle cx="22" cy="28" r="15" fill="var(--rasp)" />
        <rect x="34" y="24" width="16" height="7" rx="3.5" fill="var(--rasp)" />
        <path d="M15 26c-1-6 7-8 11-5 5 3 4 11-1 13-6 2-9-2-10-8z" fill="#FFF1C9" />
        <circle cx="22" cy="27" r="3.6" fill="var(--orange)" />
      </svg>
      <div className="caps" style={{ fontSize: 14, marginTop: 10 }}>COOKING UP IDEAS</div>
      <div style={{ fontSize: 15, marginTop: 6, color: "var(--ink)" }}>{THINKING[i]}</div>
      <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{secs < 25 ? "Usually takes 15–30 seconds" : "Nearly there…"}</div>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState<Auth>("loading");
  const [data, setData] = useState<AppState | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [back, setBack] = useState<Screen>("home");
  const [cat, setCat] = useState("All");
  const [mealId, setMealId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const [ideas, setIdeas] = useState<Record<string, Idea[]>>({});
  const [ideasLoading, setIdeasLoading] = useState<Record<string, boolean>>({});
  const [ideasError, setIdeasError] = useState<Record<string, string>>({});

  const [mood, setMood] = useState("");
  const [moodRun, setMoodRun] = useState("");
  const [moodIdeas, setMoodIdeas] = useState<Idea[]>([]);
  const [moodLoading, setMoodLoading] = useState(false);
  const [moodError, setMoodError] = useState("");

  const [extraText, setExtraText] = useState("");
  const [startPick, setStartPick] = useState(todayISO());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2800);
  }, []);

  const load = useCallback(async () => {
    const r = await fetch("/api/state", { cache: "no-store" });
    if (r.status === 401) {
      setAuth("out");
      return;
    }
    if (!r.ok) return;
    const s = (await r.json()) as AppState;
    if (inFlight.current === 0) setData(s);
    setAuth("in");
  }, []);

  useEffect(() => {
    load().catch(() => setAuth("out"));
  }, [load]);

  // Keep both phones in step: refresh every 5s while the app is open.
  useEffect(() => {
    if (auth !== "in") return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible" && inFlight.current === 0) load().catch(() => {});
    }, 5000);
    const onVis = () => document.visibilityState === "visible" && load().catch(() => {});
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [auth, load]);

  const act = useCallback(
    async (payload: Record<string, unknown>, msg?: string) => {
      inFlight.current += 1;
      try {
        const r = await fetch("/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (r.status === 401) return setAuth("out");
        if (!r.ok) return flash("Something went wrong. Try again.");
        setData((await r.json()) as AppState);
        if (msg) flash(msg);
      } catch {
        flash("You seem to be offline. Try again.");
      } finally {
        inFlight.current -= 1;
      }
    },
    [flash],
  );

  // ---------- derived ----------
  const meals = data?.meals ?? [];
  const byId = useMemo(() => new Map(meals.map((m) => [m.id, m])), [meals]);
  const plan = (data?.plan ?? []).filter((p) => byId.has(p.mealId));
  const inPlan = new Set(plan.map((p) => p.mealId));
  const today = todayISO();
  const start = data?.startDate ?? null;
  const weekOver = !start || daysBetween(start, today) > 6;
  const weekStart = start ?? today;
  const week = [0, 1, 2, 3, 4, 5, 6].map((k) => addDays(weekStart, k));
  const categories = data?.categories ?? [];

  const go = (s: Screen) => {
    setScreen(s);
    window.scrollTo(0, 0);
  };
  const openMeal = (id: string) => {
    setBack(screen === "meal" ? "meals" : screen);
    setMealId(id);
    go("meal");
  };

  const loadIdeas = useCallback(
    async (category: string, refresh = false) => {
      setIdeasLoading((s) => ({ ...s, [category]: true }));
      setIdeasError((s) => ({ ...s, [category]: "" }));
      try {
        const r = await fetch("/api/ideas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, refresh }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Couldn't get ideas");
        setIdeas((s) => ({ ...s, [category]: j.ideas }));
      } catch (e) {
        setIdeasError((s) => ({ ...s, [category]: (e as Error).message }));
      } finally {
        setIdeasLoading((s) => ({ ...s, [category]: false }));
      }
    },
    [],
  );

  useEffect(() => {
    if (auth === "in" && screen === "meals" && cat !== "All" && !ideas[cat] && !ideasLoading[cat] && !ideasError[cat]) {
      loadIdeas(cat);
    }
  }, [auth, screen, cat, ideas, ideasLoading, ideasError, loadIdeas]);

  const runMood = async (m: string) => {
    const q = m.trim();
    if (!q) return;
    setMood(q);
    setMoodRun(q);
    go("inspo");
    setMoodLoading(true);
    setMoodError("");
    setMoodIdeas([]);
    try {
      const r = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood: q }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't get ideas");
      setMoodIdeas(j.ideas);
    } catch (e) {
      setMoodError((e as Error).message);
    } finally {
      setMoodLoading(false);
    }
  };

  const dropIdea = (idea: Idea) => {
    setIdeas((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.filter((i) => i.name !== idea.name)])));
    setMoodIdeas((s) => s.filter((i) => i.name !== idea.name));
  };
  const saveIdea = async (idea: Idea, addToWeek: boolean) => {
    dropIdea(idea);
    await act(
      { type: "addMeal", name: idea.name, tags: idea.tags, ingredients: idea.ingredients, obie: idea.obie ?? null, tried: false, addToWeek },
      addToWeek ? "Added to this week and saved to your meals" : "Saved to your meals as Not tried yet",
    );
  };
  const nopeIdea = async (idea: Idea) => {
    dropIdea(idea);
    await act({ type: "dismissIdea", name: idea.name }, "Got it. We won’t suggest that again.");
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    flash("Reading your recipe…");
    try {
      const dataUrl = await resizeImage(file);
      const r = await fetch("/api/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't read that photo");
      const res = j as PhotoResult;
      if (!res.isRecipe) flash("Couldn't spot a recipe in that. Fill it in below.");
      else setToast("");
      setDraft({
        name: res.name,
        tags: res.tags.length ? res.tags : cat !== "All" ? [cat] : [],
        ingredients: res.ingredients.join("\n"),
        obie: "Dinner",
        photoUrl: res.photoUrl,
        addToWeek: false,
      });
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return flash("Give the meal a name first.");
    const ingredients = draft.ingredients.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
    const obie = draft.tags.includes(OBIE) ? draft.obie : null;
    if (draft.id) {
      await act({ type: "updateMeal", id: draft.id, name, tags: draft.tags, ingredients }, "Saved");
    } else {
      await act(
        { type: "addMeal", name, tags: draft.tags, ingredients, obie, photoUrl: draft.photoUrl, tried: false, addToWeek: draft.addToWeek },
        draft.addToWeek ? "Saved and added to this week" : "Saved to your meals",
      );
    }
    setDraft(null);
  };

  // ---------- auth screens ----------
  if (auth === "loading") {
    return <div className="app" style={{ background: "var(--orange)", alignItems: "center", justifyContent: "center" }}><p className="caps">LOADING…</p></div>;
  }
  if (auth === "out" || !data) {
    return <Login onDone={() => load()} />;
  }

  // ---------- shared bits ----------
  const deco = (m: Meal) => ({
    tagLine: m.obie ? `Obie · ${m.obie}` : m.tags.join(" · "),
    inWeek: inPlan.has(m.id),
  });

  const MealCard = ({ m, mode }: { m: Meal; mode: "add" | "remove" }) => {
    const d = deco(m);
    return (
      <article className={m.tried ? "card" : "card dashed"}>
        <Thumb tag={m.tags[0]} />
        <div className="col">
          <button type="button" className="mname" onClick={() => openMeal(m.id)}>{m.name}</button>
          <span className="tagline">{d.tagLine}</span>
          {m.tried ? (
            <span role="img" aria-label={`Rated ${m.stars} out of 5`} className="stars">{starsText(m.stars)}</span>
          ) : (
            <span className="nt">NOT TRIED YET</span>
          )}
        </div>
        {mode === "add" ? (
          <button
            type="button"
            className={d.inWeek ? "btn btn-ink" : "btn btn-rasp"}
            aria-label={d.inWeek ? `Remove ${m.name} from this week` : `Add ${m.name} to this week`}
            onClick={() => act({ type: "toggleWeek", mealId: m.id }, d.inWeek ? "Removed from this week" : "Added to this week")}
          >
            {d.inWeek ? "ADDED" : "ADD"}
          </button>
        ) : (
          <button type="button" className="iconbtn ghost" aria-label={`Remove ${m.name} from this week`} onClick={() => act({ type: "toggleWeek", mealId: m.id }, "Removed from this week")}>
            <Icon.x />
          </button>
        )}
      </article>
    );
  };

  const IdeaCard = ({ idea }: { idea: Idea }) => (
    <article className="card dashed top">
      <Thumb tag={idea.tags[0]} size={44} />
      <div className="col" style={{ gap: 6 }}>
        <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>{idea.name}</span>
        <span className="tagline">{idea.obie ? `Obie · ${idea.obie}` : idea.tags.join(" · ")}</span>
        {idea.blurb && <span className="small">{idea.blurb}</span>}
        <span className="muted">{idea.ingredients.join(", ")}</span>
        <div className="btnrow">
          <button type="button" className="btn btn-rasp btn-sm" onClick={() => saveIdea(idea, true)}>+ THIS WEEK</button>
          <button type="button" className="btn btn-line btn-sm" onClick={() => saveIdea(idea, false)}>SAVE</button>
          <button type="button" className="iconbtn ghost" style={{ width: 40, height: 40 }} aria-label={`Not for us: ${idea.name}`} onClick={() => nopeIdea(idea)}>
            <Icon.x size={18} />
          </button>
        </div>
      </div>
    </article>
  );

  const PhotoButton = () => (
    <button type="button" className="btn btn-line" style={{ width: "100%" }} disabled={photoBusy} onClick={() => fileRef.current?.click()}>
      <Icon.camera />
      {photoBusy ? <><span className="spinner" aria-hidden="true" /> READING PHOTO…</> : "ADD FROM A PHOTO"}
    </button>
  );

  const newDraft = (): Draft => ({ name: "", tags: cat !== "All" ? [cat] : [], ingredients: "", obie: "Dinner", photoUrl: null, addToWeek: false });

  // ---------- screens ----------
  let body: React.ReactNode = null;

  if (screen === "home") {
    const nudge = meals
      .filter((m) => m.tried && !m.obie && !inPlan.has(m.id) && m.lastMade && daysBetween(m.lastMade, today) >= 21)
      .sort((a, b) => (a.lastMade! < b.lastMade! ? -1 : 1))[0];
    body = (
      <>
        <header className="hdr hdr-orange">
          <div className="toprow">
            <span className="hh">{data.household}</span>
            <button type="button" className="btn-text" style={{ color: "var(--ink)" }} onClick={async () => { await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "logout" }) }); setData(null); setAuth("out"); }}>LOG OUT</button>
          </div>
          <h1 className="h1" style={{ fontSize: 36, letterSpacing: "0.02em" }}>WHAT ARE WE<br />EATING?</h1>
          <form onSubmit={(e) => { e.preventDefault(); runMood(mood); }} style={{ margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="mood1" className="lbl">IN THE MOOD FOR…</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input id="mood1" className="input" type="text" enterKeyHint="go" placeholder="spicy, BBQ, something cosy" value={mood} onChange={(e) => setMood(e.target.value)} />
              <button type="submit" className="round" aria-label="Get meal ideas"><Icon.arrow /></button>
            </div>
          </form>
        </header>
        <div className="scroll">
          <button type="button" onClick={() => go("basket")} style={{ background: "var(--ink)", color: "var(--cream-text)", border: 0, borderRadius: 22, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left" }}>
            <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span className="caps" style={{ fontSize: 13, color: "var(--orange)" }}>THIS WEEK</span>
              <span style={{ fontSize: 17, fontWeight: 700 }}>{weekOver ? "Time to plan a new week" : weekRange(weekStart)}</span>
              <span style={{ fontSize: 14 }}>{plan.length === 1 ? "1 meal in the basket" : `${plan.length} meals in the basket`}</span>
            </span>
            <span className="caps" style={{ background: "var(--orange)", color: "var(--ink)", fontSize: 13, padding: "12px 16px", borderRadius: 999 }}>{weekOver ? "START" : "VIEW"}</span>
          </button>
          {nudge && (
            <section style={{ border: "2px solid var(--ink)", borderRadius: 22, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <Thumb tag={nudge.tags[0]} size={44} />
              <div className="col" style={{ gap: 2 }}>
                <span className="caps" style={{ fontSize: 11, color: "var(--rasp-deep)" }}>DUST OFF A FAVOURITE</span>
                <button type="button" className="mname" onClick={() => openMeal(nudge.id)}>{nudge.name}</button>
                <span className="small">{lastMadeText(nudge.lastMade, nudge.tried)}</span>
              </div>
              <button type="button" className="round small" aria-label={`Add ${nudge.name} to this week`} onClick={() => act({ type: "toggleWeek", mealId: nudge.id }, "Added to this week")}><Icon.plus /></button>
            </section>
          )}
          <h2 className="sec">BROWSE OUR MEALS</h2>
          <div className="grid2">
            {categories.map((c, i) => (
              <button key={c} type="button" className={tileClass(c, i)} onClick={() => { setCat(c); go("meals"); }}>{c}</button>
            ))}
          </div>
          <button
            type="button"
            className="btn-text"
            onClick={() => {
              const n = window.prompt("Name your new category");
              if (n && n.trim()) act({ type: "addCategory", name: n.trim() }, "Category added");
            }}
          >
            + NEW CATEGORY
          </button>
        </div>
      </>
    );
  }

  if (screen === "meals") {
    const list = meals.filter((m) => (cat === "All" ? !m.tags.includes(OBIE) : m.tags.includes(cat)));
    const sorted = [...list].sort((a, b) => (a.tried === b.tried ? b.stars - a.stars : a.tried ? 1 : -1));
    const groups =
      cat === OBIE
        ? (["Lunch", "Dinner"] as const).map((t) => ({ title: t, items: sorted.filter((m) => (m.obie ?? "Dinner") === t) }))
        : [{ title: cat === "All" ? "" : "Your meals", items: sorted }];
    const catIdeas = ideas[cat] ?? [];
    body = (
      <>
        <header className="hdr hdr-orange" style={{ paddingBottom: 16 }}>
          <div className="toprow">
            <h1 className="h1" style={{ fontSize: 34 }}>OUR MEALS</h1>
            <span className="hh">{(() => { const n = meals.filter((m) => !m.tags.includes(OBIE)).length; return `${n} ${n === 1 ? "MEAL" : "MEALS"}`; })()}</span>
          </div>
          <div className="chips">
            {["All", ...categories].map((c) => (
              <button key={c} type="button" className={cat === c ? "fchip on" : "fchip"} onClick={() => setCat(c)}>{c}</button>
            ))}
          </div>
        </header>
        <div className="scroll">
          <div className="btnrow">
            <button type="button" className="btn btn-ink" onClick={() => setDraft(newDraft())}><Icon.plus size={18} />ADD A MEAL</button>
            <button type="button" className="btn btn-line" disabled={photoBusy} onClick={() => fileRef.current?.click()}>{photoBusy ? <span className="spinner" aria-hidden="true" /> : <Icon.camera />}{photoBusy ? "READING…" : "FROM A PHOTO"}</button>
          </div>
          {groups.map((g) => (
            <div key={g.title || "all"} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {g.title && <h2 className="sec">{g.title}</h2>}
              {g.items.map((m) => <MealCard key={m.id} m={m} mode="add" />)}
              {g.items.length === 0 && (
                <p className="muted">{cat === "All" ? "No meals yet. Add your favourites, or tap a category for ideas." : "Nothing saved here yet. Pick from the new ideas below."}</p>
              )}
            </div>
          ))}
          {cat !== "All" && (
            <>
              <div className="divider">
                <h2 className="sec" style={{ margin: 0 }}>NEW IDEAS</h2>
                <span className="caps pill">AI PICKS · {catIdeas.length}</span>
              </div>
              <p className="muted">Fresh ideas for {cat}. Add one to this week, or save it for later.</p>
              {ideasLoading[cat] ? (
                <Thinking />
              ) : (
                <>
                  {catIdeas.map((i) => <IdeaCard key={i.name} idea={i} />)}
                  {ideasError[cat] && <p className="err">{ideasError[cat]}</p>}
                  {!ideasError[cat] && catIdeas.length === 0 && <p className="muted">You’ve been through this batch. Ask for more below.</p>}
                </>
              )}
              <button type="button" className="btn btn-ink btn-big" disabled={!!ideasLoading[cat]} onClick={() => loadIdeas(cat, true)}>{ideasLoading[cat] ? <><span className="spinner" aria-hidden="true" /> THINKING…</> : "GIVE ME NEW IDEAS"}</button>
            </>
          )}
        </div>
      </>
    );
  }

  if (screen === "meal") {
    const m = mealId ? byId.get(mealId) : undefined;
    if (!m) {
      body = <div className="scroll"><p className="muted">That meal has gone.</p><button type="button" className="btn btn-ink" onClick={() => go("meals")}>BACK TO OUR MEALS</button></div>;
    } else {
      const sh = shapeFor(m.tags[0]);
      const d = deco(m);
      body = (
        <>
          <header className={sh.hdr} style={{ paddingBottom: 22 }}>
            <div className="toprow">
              <button type="button" className="iconbtn" aria-label="Back" onClick={() => go(back)}><Icon.back /></button>
              <svg width="72" height="72" viewBox="0 0 52 52" aria-hidden="true"><path d={sh.d} fill={sh.hfg} /></svg>
            </div>
            <h1 className="h1" style={{ fontSize: 30, letterSpacing: "0.03em" }}>{m.name}</h1>
            <span className="caps" style={{ fontSize: 11 }}>{d.tagLine}</span>
          </header>
          <div className="scroll">
            {!m.tried && <span className="nt" style={{ alignSelf: "flex-start" }}>NOT TRIED YET</span>}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="lbl">YOUR RATING</span>
              <div className="starrow">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" className="starbtn" aria-label={`Rate ${n} out of 5`} onClick={() => act({ type: "updateMeal", id: m.id, stars: n }, m.tried ? "Rating saved" : "Rated, and added to the rotation")}>
                    {n <= m.stars ? "★" : "☆"}
                  </button>
                ))}
              </div>
              <span className="muted">{lastMadeText(m.lastMade, m.tried)}</span>
            </div>
            {m.photoUrl && (
              <a href={m.photoUrl} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="photo" src={m.photoUrl} alt={`Recipe photo for ${m.name}`} />
              </a>
            )}
            <h2 className="sec">MAIN INGREDIENTS</h2>
            <div>
              {m.ingredients.map((i) => <div key={i} className="ing"><span className="dot" />{i}</div>)}
              {m.ingredients.length === 0 && <p className="muted">No ingredients yet. Tap Edit to add some.</p>}
            </div>
            <button type="button" className={d.inWeek ? "btn btn-ink btn-big" : "btn btn-rasp btn-big"} style={{ marginTop: 6 }} onClick={() => act({ type: "toggleWeek", mealId: m.id }, d.inWeek ? "Removed from this week" : "Added to this week")}>
              {d.inWeek ? "IN THIS WEEK ✓" : "ADD TO THIS WEEK"}
            </button>
            <button type="button" className="btn btn-line" onClick={() => setDraft({ id: m.id, name: m.name, tags: m.tags, ingredients: m.ingredients.join("\n"), obie: m.obie ?? "Dinner", photoUrl: m.photoUrl, addToWeek: false })}>EDIT</button>
            <button
              type="button"
              className="btn-text"
              onClick={async () => {
                if (!window.confirm(`Remove ${m.name}? We won't suggest it again.`)) return;
                go(back === "meal" ? "meals" : back);
                await act({ type: "removeMeal", id: m.id }, "Removed. We won’t suggest it again.");
              }}
            >
              NOT FOR US: REMOVE THIS MEAL
            </button>
          </div>
        </>
      );
    }
  }

  if (screen === "inspo") {
    body = (
      <>
        <header className="hdr hdr-rasp" style={{ paddingBottom: 18 }}>
          <h1 className="h1" style={{ fontSize: 34 }}>MEALS INSPO</h1>
          <form onSubmit={(e) => { e.preventDefault(); runMood(mood); }} style={{ margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="mood2" className="lbl">IN THE MOOD FOR…</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input id="mood2" className="input" type="text" enterKeyHint="go" placeholder="spicy, BBQ, something cosy" value={mood} onChange={(e) => setMood(e.target.value)} style={{ borderColor: "var(--cream-text)" }} />
              <button type="submit" className="round" style={{ background: "var(--orange)", color: "var(--ink)" }} aria-label="Get meal ideas"><Icon.arrow /></button>
            </div>
          </form>
          <div className="chips">
            {MOODS.map((c) => <button key={c} type="button" className="fchip" onClick={() => runMood(c)}>{c}</button>)}
          </div>
        </header>
        <div className="scroll">
          <PhotoButton />
          {moodRun ? <h2 className="sec">IDEAS FOR “{moodRun.toUpperCase()}”</h2> : <p className="muted">Type what you fancy this week, or tap a mood, and we’ll suggest some dinners.</p>}
          {moodLoading && <Thinking />}
          {moodError && <p className="err">{moodError}</p>}
          {moodIdeas.map((i) => <IdeaCard key={i.name} idea={i} />)}
          {moodRun && !moodLoading && <button type="button" className="btn btn-ink btn-big" onClick={() => runMood(moodRun)}>GIVE ME NEW IDEAS</button>}
        </div>
      </>
    );
  }

  if (screen === "basket") {
    const startOpts = [0, 1, 2, 3, 4, 5, 6].map((k) => addDays(today, k));
    body = (
      <>
        <header className="hdr hdr-pink">
          <div className="toprow">
            <h1 className="h1" style={{ fontSize: 44, letterSpacing: "0.08em" }}>THIS WEEK</h1>
            <span className="hh">{plan.length}</span>
          </div>
          {!weekOver && <p className="caps" style={{ margin: 0, fontSize: 13 }}>{weekRange(weekStart).toUpperCase()} · {plan.length} MEALS</p>}
        </header>
        <div className="scroll">
          {weekOver && (
            <section className="pcard" style={{ background: "var(--orange)" }}>
              <h2 className="sec" style={{ margin: 0 }}>START A NEW WEEK</h2>
              <label htmlFor="start" className="small" style={{ fontWeight: 700 }}>What day do you want this to start on?</label>
              <select id="start" className="select" value={startPick} onChange={(e) => setStartPick(e.target.value)}>
                {startOpts.map((d) => <option key={d} value={d}>{longLabel(d)}</option>)}
              </select>
              <button type="button" className="btn btn-ink" onClick={() => act({ type: "startWeek", startDate: startPick }, `Week starts ${longLabel(startPick)}`)}>START THE WEEK</button>
              {plan.length > 0 && <p className="small" style={{ margin: 0 }}>Meals you didn’t get round to will carry over.</p>}
            </section>
          )}
          {plan.map((p) => <MealCard key={p.mealId} m={byId.get(p.mealId)!} mode="remove" />)}
          {plan.length === 0 && <p className="muted">Your basket is empty. Add meals from Our meals or Meals inspo.</p>}
          <button type="button" className="btn-text" onClick={() => { setCat("All"); go("meals"); }}>+ ADD MORE MEALS</button>
          {plan.length > 0 && (
            <>
              <button type="button" className="btn btn-orange btn-big" onClick={() => go("plan")}>PLAN THE DAYS</button>
              <button type="button" className="btn btn-ink btn-big" onClick={() => go("shop")}>SHOPPING LIST</button>
            </>
          )}
          {!weekOver && (
            <button
              type="button"
              className="btn-text"
              onClick={() => {
                if (window.confirm("Start a new week? Made meals leave the basket and the shopping list resets.")) {
                  act({ type: "startWeek", startDate: startPick >= today ? startPick : today }, "New week started");
                }
              }}
            >
              START A NEW WEEK
            </button>
          )}
        </div>
      </>
    );
  }

  if (screen === "plan") {
    body = (
      <>
        <header className="hdr hdr-ink">
          <div className="toprow">
            <button type="button" className="iconbtn" aria-label="Back to this week" onClick={() => go("basket")}><Icon.back /></button>
            <span className="hh">{data.household}</span>
          </div>
          <h1 className="h1" style={{ fontSize: 38 }}>PLAN THE DAYS</h1>
          <p className="caps" style={{ margin: 0, fontSize: 13, color: "var(--orange)" }}>{weekRange(weekStart).toUpperCase()}</p>
        </header>
        <div className="scroll">
          <p className="small" style={{ margin: 0 }}>Tap a day for each meal. Tick it when you’ve made it.</p>
          {plan.map((p) => {
            const m = byId.get(p.mealId)!;
            const dayLabel = p.day === null ? "No day yet" : `${shortDay(week[p.day]).dow} ${shortDay(week[p.day]).date}${p.made ? " · Made ✓" : ""}`;
            return (
              <article key={p.mealId} className="pcard">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="col">
                    <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>{m.name}</span>
                    <span className="tagline">{dayLabel}</span>
                  </div>
                  <button type="button" className={p.made ? "check on" : "check"} aria-pressed={p.made} aria-label={p.made ? "Made it (tap to undo)" : `Mark ${m.name} as made`} onClick={() => act({ type: "setMade", mealId: m.id, made: !p.made, today }, !p.made && m.tried ? "Nice! Last made date updated." : undefined)}>
                    <Icon.tick />
                  </button>
                </div>
                <div className="daychips">
                  {week.map((d, k) => {
                    const sd = shortDay(d);
                    return (
                      <button key={d} type="button" className={p.day === k ? "daychip on" : "daychip"} aria-label={`${m.name} on ${longLabel(d)}`} onClick={() => act({ type: "setDay", mealId: m.id, day: p.day === k ? null : k })}>
                        <span>{sd.dow}</span>
                        <span>{sd.date}</span>
                      </button>
                    );
                  })}
                </div>
                {p.made && !m.tried && (
                  <div className="fb">
                    <span className="caps" style={{ fontSize: 12 }}>FIRST TIME! HOW WAS IT?</span>
                    <div className="starrow">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} type="button" className="starbtn" aria-label={`Rate ${n} out of 5`} onClick={() => act({ type: "updateMeal", id: m.id, stars: n }, `Rated ${n}/5 and added to the rotation`)}>★</button>
                      ))}
                    </div>
                    <button type="button" className="btn btn-ink" style={{ alignSelf: "flex-start" }} onClick={() => act({ type: "removeMeal", id: m.id }, "Removed. We won’t suggest it again.")}>NOT FOR US</button>
                  </div>
                )}
              </article>
            );
          })}
          <h2 className="sec">THE WEEK AT A GLANCE</h2>
          <div>
            {week.map((d, k) => {
              const names = plan.filter((p) => p.day === k).map((p) => byId.get(p.mealId)!.name);
              const sd = shortDay(d);
              return (
                <div key={d} className="weekrow"><span className="weekday">{sd.dow} {sd.date}</span><span style={{ fontSize: 15 }}>{names.length ? names.join(", ") : "–"}</span></div>
              );
            })}
          </div>
          <button type="button" className="btn btn-orange btn-big" style={{ marginTop: 8 }} onClick={() => go("shop")}>SHOPPING LIST</button>
        </div>
      </>
    );
  }

  if (screen === "shop") {
    const counts = new Map<string, { name: string; n: number }>();
    for (const p of plan) {
      for (const i of byId.get(p.mealId)!.ingredients) {
        const k = key(i);
        const cur = counts.get(k);
        counts.set(k, { name: cur?.name ?? i, n: (cur?.n ?? 0) + 1 });
      }
    }
    const have = new Set(data.have);
    const items = [
      ...[...counts.values()].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ name: c.name, note: c.n > 1 ? `${c.n} MEALS` : "", extraId: null as number | null })),
      ...data.extras.map((e) => ({ name: e.name, note: "EXTRA", extraId: e.id as number | null })),
    ].map((it) => ({ ...it, got: have.has(key(it.name)) }));
    items.sort((a, b) => (a.got === b.got ? 0 : a.got ? 1 : -1));
    const toBuy = items.filter((i) => !i.got);
    body = (
      <>
        <header className="hdr hdr-orange">
          <div className="toprow">
            <button type="button" className="iconbtn" aria-label="Back to this week" onClick={() => go("basket")}><Icon.back /></button>
            <button
              type="button"
              className="btn btn-ink"
              onClick={async () => {
                const text = toBuy.map((x) => `- ${x.name}`).join("\n");
                try {
                  await navigator.clipboard.writeText(text);
                  flash("List copied. Paste it into Sainsbury’s or your notes.");
                } catch {
                  flash("Couldn't copy on this device.");
                }
              }}
            >
              COPY LIST
            </button>
          </div>
          <h1 className="h1" style={{ fontSize: 38 }}>SHOPPING LIST</h1>
          <p className="caps" style={{ margin: 0, fontSize: 13 }}>{toBuy.length} TO BUY · {items.length - toBuy.length} GOT</p>
        </header>
        <div className="scroll">
          <p className="small" style={{ margin: 0 }}>Tap anything you’ve already got. You both see the same list.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = extraText.trim();
              if (v) {
                setExtraText("");
                act({ type: "addExtra", name: v });
              }
            }}
            style={{ margin: 0, display: "flex", gap: 8 }}
          >
            <label htmlFor="extra" className="sr">Add an extra item</label>
            <input id="extra" className="input" type="text" enterKeyHint="done" placeholder="Add extras: milk, nappies…" value={extraText} onChange={(e) => setExtraText(e.target.value)} />
            <button type="submit" className="round" aria-label="Add item"><Icon.plus /></button>
          </form>
          <div>
            {items.map((it) => (
              <div key={`${it.name}-${it.extraId ?? "i"}`} style={{ display: "flex", alignItems: "center" }}>
                <button type="button" className={it.got ? "shoprow got" : "shoprow"} aria-pressed={it.got} onClick={() => act({ type: "toggleHave", name: it.name, got: !it.got })}>
                  <span className="box"><Icon.tick size={14} /></span>
                  <span>{it.name}</span>
                  <span className="cnt">{it.note}</span>
                </button>
                {it.extraId !== null && (
                  <button type="button" className="iconbtn ghost" aria-label={`Delete ${it.name}`} onClick={() => act({ type: "removeExtra", id: it.extraId })}><Icon.x size={16} /></button>
                )}
              </div>
            ))}
          </div>
          {items.length === 0 && <p className="muted">Add meals to this week and their ingredients will appear here.</p>}
        </div>
      </>
    );
  }

  const tab = (on: boolean) => (on ? "tab on" : "tab");

  return (
    <div className="app">
      {body}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
      <nav aria-label="Main" className="tabs">
        <button type="button" className={tab(screen === "home")} onClick={() => go("home")}><Icon.home />Home</button>
        <button type="button" className={tab(screen === "meals" || screen === "meal")} onClick={() => { setCat("All"); go("meals"); }}><Icon.list />Our meals</button>
        <button type="button" className={tab(screen === "inspo")} onClick={() => go("inspo")}><Icon.bulb />Meals inspo</button>
        <button type="button" className={tab(screen === "basket" || screen === "plan" || screen === "shop")} onClick={() => go("basket")}>
          <span className="badgewrap"><Icon.bag />{plan.length > 0 && <span className="badge">{plan.length}</span>}</span>This week
        </button>
      </nav>
      {toast && <div className="toast" role="status">{toast}</div>}
      {draft && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label={draft.id ? "Edit meal" : "Add a meal"} onClick={(e) => e.target === e.currentTarget && setDraft(null)}>
          <div className="sheet-body">
            <div className="toprow">
              <h2 className="h1" style={{ fontSize: 26 }}>{draft.id ? "EDIT MEAL" : "ADD A MEAL"}</h2>
              <button type="button" className="iconbtn" aria-label="Close" onClick={() => setDraft(null)}><Icon.x /></button>
            </div>
            {draft.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="photo" src={draft.photoUrl} alt="Recipe photo" />
            )}
            <label htmlFor="dname" className="lbl">NAME</label>
            <input id="dname" className="field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Lamb koftas & flatbreads" />
            <span className="lbl">CATEGORIES</span>
            <div className="tagpick">
              {categories.map((c) => {
                const on = draft.tags.includes(c);
                return (
                  <button key={c} type="button" aria-pressed={on} className={on ? "fchip on" : "fchip"} onClick={() => setDraft({ ...draft, tags: on ? draft.tags.filter((t) => t !== c) : [...draft.tags, c] })}>{c}</button>
                );
              })}
            </div>
            {draft.tags.includes(OBIE) && (
              <div className="btnrow">
                <span className="lbl">FOR OBIE’S</span>
                {(["Lunch", "Dinner"] as const).map((o) => (
                  <button key={o} type="button" aria-pressed={draft.obie === o} className={draft.obie === o ? "fchip on" : "fchip"} onClick={() => setDraft({ ...draft, obie: o })}>{o}</button>
                ))}
              </div>
            )}
            <label htmlFor="ding" className="lbl">MAIN INGREDIENTS (ONE PER LINE)</label>
            <textarea id="ding" className="field" value={draft.ingredients} onChange={(e) => setDraft({ ...draft, ingredients: e.target.value })} placeholder={"Chicken thighs\nHarissa paste\nRed onion"} />
            {!draft.id && (
              <label className="btnrow small" style={{ fontWeight: 700 }}>
                <input type="checkbox" checked={draft.addToWeek} onChange={(e) => setDraft({ ...draft, addToWeek: e.target.checked })} style={{ width: 22, height: 22 }} />
                Add to this week too
              </label>
            )}
            <button type="button" className="btn btn-rasp btn-big" disabled={busy} onClick={async () => { setBusy(true); await saveDraft(); setBusy(false); }}>SAVE</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [household, setHousehold] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, household, password, remember }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setError(j.error || "Something went wrong.");
      else onDone();
    } catch {
      setError("You seem to be offline.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app" style={{ background: "var(--orange)", padding: "28px 28px 36px", gap: 18 }}>
      <LoginArt />
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h1 className="h1" style={{ fontSize: 80, letterSpacing: "0.03em", lineHeight: 0.95 }}>M.E.G.A</h1>
        <p style={{ margin: 0, fontFamily: "var(--display)", fontWeight: 800, fontSize: 19, letterSpacing: "0.16em", color: "var(--rasp-deep)" }}>MAKE EATING GREAT AGAIN</p>
      </div>
      <form onSubmit={submit} style={{ marginTop: "auto", background: "var(--cream)", borderRadius: 28, padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
        {mode === "signup" && <p className="small" style={{ margin: 0, fontWeight: 700 }}>Set up your household. You’ll both log in with the same name and password.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label htmlFor="hh" className="lbl">HOUSEHOLD</label>
          <input id="hh" className="field" type="text" autoComplete="username" autoCapitalize="words" placeholder="e.g. 83 Rox" value={household} onChange={(e) => setHousehold(e.target.value)} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label htmlFor="pw" className="lbl">PASSWORD</label>
          <input id="pw" className="field" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 22, height: 22, accentColor: "var(--rasp)" }} />
          Keep me logged in
        </label>
        {error && <p className="err">{error}</p>}
        <button type="submit" className="btn btn-rasp btn-big" disabled={busy} style={{ marginTop: 4, fontSize: 19 }}>
          {busy ? "…" : mode === "login" ? "LET'S EAT" : "SET UP OUR HOUSEHOLD"}
        </button>
        <p style={{ margin: 0, textAlign: "center", fontSize: 15 }}>
          {mode === "login" ? "New household? " : "Already set up? "}
          <button type="button" className="mname" style={{ display: "inline", textDecoration: "underline", fontSize: 15 }} onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>
            {mode === "login" ? "Set one up" : "Log in"}
          </button>
        </p>
      </form>
    </div>
  );
}
