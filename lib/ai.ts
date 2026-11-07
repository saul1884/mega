import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Idea } from "./types";
import { describeCategories, type Category } from "./categories";
import { householdContext, type Tastes } from "./tastes";

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

const PhotoSchema = z.object({
  is_recipe: z.boolean().describe("True if the image shows a recipe or a dish you can identify"),
  name: z.string().describe("The dish name, short"),
  ingredients: z.array(z.string()).describe("The main ingredients to buy, 3-10 items"),
  tags: z.array(z.string()).describe("1-2 categories from the provided list that fit"),
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
      text: `This is a photo of a recipe from a cookbook or a social media post. Read the dish name and its main ingredients (things to buy, not quantities). Pick 1-2 categories from this list (use the exact names):\n${describeCategories(opts.categories)}\n If there's no recipe or dish in the image, set is_recipe to false.`,
    },
  ]);
  const allowed = new Set(opts.categories.map((c) => c.name));
  return {
    isRecipe: !!raw?.is_recipe,
    name: raw?.name?.trim() ?? "",
    ingredients: (raw?.ingredients ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 12),
    tags: (raw?.tags ?? []).filter((t) => allowed.has(t)).slice(0, 2),
  };
}
