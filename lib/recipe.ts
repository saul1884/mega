import { z } from "zod";

export type RecipeStyle = "slow_cooker" | "one_pan" | "other";

export type Recipe = {
  style: RecipeStyle;
  prep: string; // "15 min prep"
  cook: string; // "8 hrs on low"
  serves: string; // "Serves 4"
  note: string; // one line that plays on the style
  phases: { title: string; steps: string[] }[]; // steps use **bold** for amounts
  tip: string;
};

export const MAX_STEPS = 10;

const short = z.string().trim().max(80);
export const RecipeInput = z.object({
  style: z.enum(["slow_cooker", "one_pan", "other"]),
  prep: short,
  cook: short,
  serves: short,
  note: z.string().trim().max(300),
  phases: z
    .array(z.object({ title: z.string().trim().max(40), steps: z.array(z.string().trim().min(1).max(400)).max(MAX_STEPS) }))
    .min(1)
    .max(4),
  tip: z.string().trim().max(300),
});

export function stepCount(r: Recipe): number {
  return r.phases.reduce((n, p) => n + p.steps.length, 0);
}

/** Keeps at most MAX_STEPS steps and drops empty phases. */
export function capSteps(r: Recipe): Recipe {
  let left = MAX_STEPS;
  const phases = r.phases
    .map((p) => {
      const steps = p.steps.map((s) => s.trim()).filter(Boolean).slice(0, Math.max(0, left));
      left -= steps.length;
      return { title: p.title.trim(), steps };
    })
    .filter((p) => p.steps.length);
  return { ...r, phases };
}

/** Plain numbered text, so a recipe can be edited by hand and tidied again. */
export function recipeToText(r: Recipe): string {
  let n = 0;
  return r.phases
    .map((p) => (p.title ? `${p.title}:\n` : "") + p.steps.map((s) => `${++n}. ${s.replace(/\*\*/g, "")}`).join("\n"))
    .join("\n\n");
}
