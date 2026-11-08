import { Fragment } from "react";
import { stepCount, type Recipe } from "@/lib/recipe";

const LEAD: Record<Recipe["style"], string> = { slow_cooker: "Slow cooker", one_pan: "One pan", other: "" };

/** "Fry **2 onions**" → Fry <b>2 onions</b>, without using innerHTML. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : <Fragment key={i}>{part}</Fragment>))}
    </>
  );
}

export function RecipeView({ recipe, compact = false }: { recipe: Recipe; compact?: boolean }) {
  let n = 0;
  const meta = [recipe.prep, recipe.cook, recipe.serves].filter(Boolean);
  const lead = LEAD[recipe.style];
  const total = stepCount(recipe);
  return (
    <section className="recipe" aria-label="Recipe">
      {!compact && (
        <div className="rhead">
          <h2 className="sec">THE RECIPE</h2>
          <span className="lbl" style={{ color: "var(--rasp)" }}>{total} STEP{total === 1 ? "" : "S"}</span>
        </div>
      )}
      {meta.length > 0 && <div className="rmeta">{meta.map((m) => <span key={m}>{m}</span>)}</div>}
      {recipe.note && (
        <div className="rnote">
          {lead && <b>{lead}: </b>}
          {lead ? recipe.note.charAt(0).toLowerCase() + recipe.note.slice(1) : recipe.note}
        </div>
      )}
      {recipe.phases.map((p, pi) => (
        <Fragment key={pi}>
          {p.title && <div className="phase">{p.title}</div>}
          <ol className="steps">
            {p.steps.map((s, si) => (
              <li key={si}>
                <span className="n" aria-hidden="true">{++n}</span>
                <div><span className="sr">Step {n}. </span><Rich text={s} /></div>
              </li>
            ))}
          </ol>
        </Fragment>
      ))}
      {recipe.tip && <p className="tip">Tip: {recipe.tip.replace(/^tip:\s*/i, "")}</p>}
    </section>
  );
}
