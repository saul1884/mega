import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Idea } from "./types";
import { describeCategories, type Category } from "./categories";
import { householdContext, type Tastes } from "./tastes";
import { capSteps, MAX_STEPS, type Recipe } from "./recipe";

const MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}


const IdeaSchema = z.object({
  name: z.string().describe("Short dish name, max 6 words"),
  blurb: z.string().describe("One short, appetising sentence: why it's good and how much effort it takes"),
  ingredients: z.array(z.string()).describe("4-8 main ingredients to buy, e.g. 'Chicken thighs'"),
  tags: z.array(z.string()).describe("1-2 categories from the provided list that fit this dish"),
  obie: z.enum(["Lunch", "Dinner"]).nullable().describe("Only for kids' meals: Lunch or Dinner. Otherwise null"),
});
const IdeasSchema = z.object({ ideas: z.array(IdeaSchema) });

const RecipeSchema = z.object({
  style: z.enum(["slow_cooker", "one_pan", "other"]).describe("slow_cooker if it's made in a slow cooker; one_pan if it's all cooked in one pan, pot or tray; otherwise other"),
  prep_minutes: z.number().int().describe("Hands-on prep time in minutes"),
  cook: z.string().describe("Short cooking time label, e.g. '8 hrs on low', '35 min in the oven', '15 min cook'"),
  serves: z.string().describe("e.g. 'Serves 4' or 'Serves 2 + 1 child'"),
  note: z.string().describe("One short sentence that plays on what makes this easy, e.g. for a slow cooker: 15 minutes before work, then forget about it"),
  phases: z
    .array(z.object({ title: z.string().describe("Short heading like 'In the morning', or empty string when there's only one phase"), steps: z.array(z.string()) }))
    .describe("Usually one phase. Slow cooker: 'In the morning' and 'At dinner time'"),
  tip: z.string().describe("One short practical tip (freezing, a swap, making it kid-friendly), or empty string"),
  shopping: z.array(z.string()).describe("3-10 main ingredients to buy, no quantities, e.g. 'Chicken thighs'"),
});

const RECIPE_RULES = `How to write the recipe:
- Really simple to follow: numbered steps, ${MAX_STEPS} at most, and fewer wherever you can (most dinners need 4 to 7). One action per step, one or two short sentences.
- Put amounts inline in bold with double asterisks, e.g. "Fry **2 onions** in **1 tbsp oil**", so nobody has to look back at a list. UK metric; oven as "**200°C (180°C fan)**".
- Slow cooker meals: style slow_cooker, two phases titled "In the morning" (prep, then lid on with the setting and time in bold, e.g. **LOW for 8 hours**) and "At dinner time" (finishing and serving). Keep the morning part short.
- One pan or tray meals: style one_pan, one phase with an empty title. Everything happens in that one pan or tray; never use a second pan. The note says so (one thing to wash).
- Anything else: style other, one phase with an empty title unless there's a natural split (e.g. "The night before").
- Serves: based on who's eating in the household.`;

function cleanRecipe(raw: z.infer<typeof RecipeSchema> | null): { recipe: Recipe; shopping: string[] } | null {
  if (!raw || !raw.phases?.some((p) => p.steps.length)) return null;
  const recipe = capSteps({
    style: raw.style,
    prep: `${Math.max(1, Math.round(raw.prep_minutes))} min prep`,
    cook: raw.cook.trim().slice(0, 80),
    serves: raw.serves.trim().slice(0, 80),
    note: raw.note.trim().slice(0, 300),
    phases: raw.phases.map((p) => ({ title: p.title.slice(0, 40), steps: p.steps.map((s) => s.slice(0, 400)) })).slice(0, 4),
    tip: raw.tip.trim().slice(0, 300),
  });
  return { recipe, shopping: raw.shopping.map((s) => s.trim()).filter(Boolean).slice(0, 12) };
}

export async function writeRecipe(opts: {
  name: string;
  ingredients: string[];
  tags: string[];
  kids: boolean;
  tastes: Tastes | null;
  text?: string;
}): Promise<{ recipe: Recipe; shopping: string[] } | null> {
  const about = [
    `Dish: ${opts.name}`,
    `Their categories for it: ${opts.tags.join(", ") || "none"}`,
    `Main ingredients: ${opts.ingredients.join(", ") || "not listed"}`,
    ...(opts.kids ? ["This is a meal for the children: keep it mild and quick."] : []),
  ].join("\n");
  const task = opts.text
    ? `This is their own recipe, typed or pasted in however they liked:\n"""\n${opts.text.slice(0, 6000)}\n"""\n\nRewrite it as a clear recipe. Keep their dish, method and amounts; don't add ingredients they didn't use beyond obvious basics. Fix the order if needed.`
    : `Write a recipe for this dish.`;
  const raw = await ask(RecipeSchema, householdContext(opts.tastes), [{ type: "text", text: [about, task, RECIPE_RULES].join("\n\n") }]);
  return cleanRecipe(raw);
}

const PhotoSchema = z.object({
  is_recipe: z.boolean().describe("True if the image shows a recipe or a dish you can identify"),
  name: z.string().describe("The dish name, short"),
  ingredients: z.array(z.string()).describe("The main ingredients to buy, 3-10 items"),
  tags: z.array(z.string()).describe("1-2 categories from the provided list that fit"),
  recipe: RecipeSchema.nullable().describe("If the image shows the method or steps, the recipe rewritten using the rules. Otherwise null"),
});

function cleanIdeas(raw: z.infer<typeof IdeasSchema> | null, categories: Category[], count: number): Idea[] {
  const allowed = new Set(categories.map((c) => c.name));
  return (raw?.ideas ?? []).slice(0, count).map((i) => ({
    name: i.name.trim(),
    blurb: i.blurb.trim(),
    ingredients: i.ingredients.map((s) => s.trim()).filter(Boolean).slice(0, 10),
    tags: i.tags.filter((t) => allowed.has(t)).slice(0, 2),
    obie: i.obie ?? null,
  }));
}

async function ask<T extends z.ZodType>(schema: T, system: string, content: Anthropic.Beta.Messages.BetaContentBlockParam[]) {
  const response = await anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal") throw new Error("The AI declined this request.");
  return response.parsed_output as z.infer<T> | null;
}

export async function categoryIdeas(opts: {
  category: string;
  categories: Category[];
  avoid: string[];
  tastes: Tastes | null;
  count?: number;
}): Promise<Idea[]> {
  const count = opts.count ?? 10;
  const cat = opts.categories.find((c) => c.name === opts.category);
  const isKids = !!cat?.kids;
  const ages = opts.tastes?.kidAges ?? [];
  const kidAges = ages.length ? ` The children are ${ages.map((a) => (a === 0 ? "under 1" : `${a}`)).join(", ")} years old; pitch textures and flavours to suit.` : "";
  const about = cat?.description ? ` The household describes this category as: "${cat.description}".` : "";
  const brief = isKids
    ? `Suggest ${count} meals for the category "${opts.category}", which is for their children.${about}${kidAges} Mix lunches and dinners (about half each), set "obie" to Lunch or Dinner, and tag each with "${opts.category}". Keep them simple, mild and quick, but not boring.`
    : `Suggest ${count} dinner ideas for the grown-ups that fit the category "${opts.category}".${about} Every idea must be tagged "${opts.category}"; add one more category from the list only if it clearly fits. Make them varied across cuisines and main ingredients.`;
  const avoid = opts.avoid.length
    ? `\n\nDo not suggest any of these (they already have them, or said no): ${opts.avoid.slice(0, 200).join("; ")}.`
    : "";
  const raw = await ask(IdeasSchema, householdContext(opts.tastes), [
    { type: "text", text: `Their categories:\n${describeCategories(opts.categories)}\n\n${brief}${avoid}` },
  ]);
  return cleanIdeas(raw, opts.categories, count).map((i) => ({
    ...i,
    tags: i.tags.includes(opts.category) ? i.tags : [opts.category, ...i.tags].slice(0, 2),
    obie: isKids ? (i.obie ?? "Dinner") : null,
  }));
}

export async function moodIdeas(opts: { mood: string; categories: Category[]; avoid: string[]; tastes: Tastes | null }): Promise<Idea[]> {
  const grownUp = opts.categories.filter((c) => !c.kids);
  const avoid = opts.avoid.length
    ? `\n\nDo not suggest any of these (they already have them, or said no): ${opts.avoid.slice(0, 200).join("; ")}.`
    : "";
  const raw = await ask(IdeasSchema, householdContext(opts.tastes), [
    {
      type: "text",
      text: `Their categories:\n${describeCategories(grownUp)}\n\nThis week they're in the mood for: "${opts.mood}". Suggest 6 dinner ideas for the grown-ups that match that mood, each tagged with 1-2 categories from the list. Set "obie" to null.${avoid}`,
    },
  ]);
  return cleanIdeas(raw, grownUp, 6).map((i) => ({ ...i, obie: null }));
}

export async function readRecipePhoto(opts: {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  categories: Category[];
  tastes: Tastes | null;
}) {
  const raw = await ask(PhotoSchema, householdContext(opts.tastes), [
    { type: "image", source: { type: "base64", media_type: opts.mediaType, data: opts.base64 } },
    {
      type: "text",
      text: `This is a photo of a recipe from a cookbook or a social media post. Read the dish name and its main ingredients (things to buy, not quantities). Pick 1-2 categories from this list (use the exact names):\n${describeCategories(opts.categories)}\n If there's no recipe or dish in the image, set is_recipe to false.\n\nIf the method is shown, also fill in "recipe": keep their method and amounts, rewritten like this.\n${RECIPE_RULES}`,
    },
  ]);
  const allowed = new Set(opts.categories.map((c) => c.name));
  return {
    isRecipe: !!raw?.is_recipe,
    name: raw?.name?.trim() ?? "",
    ingredients: (raw?.ingredients ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 12),
    tags: (raw?.tags ?? []).filter((t) => allowed.has(t)).slice(0, 2),
    recipe: cleanRecipe(raw?.recipe ? { ...raw.recipe, shopping: [] } : null)?.recipe ?? null,
  };
}
