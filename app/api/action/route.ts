import { normalizeCategories, type Category } from "@/lib/categories";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureSchema, nameKey, sql } from "@/lib/db";
import { getHouseholdId } from "@/lib/auth";
import { loadState } from "@/lib/state";
import { capSteps, RecipeInput } from "@/lib/recipe";

const name = z.string().trim().min(1).max(120);
const list = z.array(z.string().trim().min(1).max(120)).max(40);
const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const Action = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("addMeal"),
    name,
    tags: list,
    ingredients: list,
    obie: z.enum(["Lunch", "Dinner"]).nullable().optional(),
    photoUrl: z.string().url().max(500).nullable().optional(),
    tried: z.boolean().optional(),
    stars: z.number().int().min(0).max(5).optional(),
    addToWeek: z.boolean().optional(),
    recipe: RecipeInput.nullable().optional(),
  }),
  z.object({
    type: z.literal("updateMeal"),
    id: uuid,
    name: name.optional(),
    tags: list.optional(),
    ingredients: list.optional(),
    stars: z.number().int().min(0).max(5).optional(),
    recipe: RecipeInput.nullable().optional(),
  }),
  z.object({ type: z.literal("removeMeal"), id: uuid }),
  z.object({ type: z.literal("dismissIdea"), name }),
  z.object({ type: z.literal("toggleWeek"), mealId: uuid }),
  z.object({ type: z.literal("setDay"), mealId: uuid, day: z.number().int().min(0).max(6).nullable() }),
  z.object({ type: z.literal("setMade"), mealId: uuid, made: z.boolean(), today: date }),
  z.object({ type: z.literal("startWeek"), startDate: date }),
  z.object({ type: z.literal("toggleHave"), name, got: z.boolean() }),
  z.object({ type: z.literal("addExtra"), name }),
  z.object({ type: z.literal("removeExtra"), id: z.number().int() }),
  z.object({ type: z.literal("addCategory"), name: z.string().trim().min(1).max(40), description: z.string().trim().max(300).default("") }),
  z.object({ type: z.literal("updateCategory"), name: z.string().min(1).max(40), description: z.string().trim().max(300) }),
  z.object({ type: z.literal("removeCategory"), name: z.string().min(1).max(40) }),
  z.object({
    type: z.literal("setTastes"),
    tastes: z.object({
      adults: z.number().int().min(1).max(12),
      kidAges: z.array(z.number().int().min(0).max(17)).max(10),
      diet: z.enum(["none", "vegetarian", "pescatarian", "vegan"]),
      dietExtras: z.array(z.string().trim().min(1).max(40)).max(12),
      never: z.array(z.string().trim().min(1).max(40)).max(40),
      time: z.enum(["quick", "medium", "relaxed"]),
      adventure: z.enum(["familiar", "mix", "surprise"]).optional(),
      notes: z.string().trim().max(500),
      skipped: z.boolean().optional(),
    }),
  }),
]);

export async function POST(req: Request) {
  const hid = await getHouseholdId();
  if (!hid) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const parsed = Action.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  await ensureSchema();
  const db = sql();
  const a = parsed.data;

  // Every meal-specific action must belong to this household.
  const ownMeal = async (id: string) => {
    const [m] = await db`select id from meals where id = ${id} and household_id = ${hid}`;
    return !!m;
  };

  switch (a.type) {
    case "addMeal": {
      // Saving the same meal twice (e.g. an idea tapped twice) reuses the existing one.
      const existing = await db`select id, name from meals where household_id = ${hid}`;
      const dup = existing.find((r) => nameKey(r.name) === nameKey(a.name));
      // An idea whose recipe was already opened keeps that recipe.
      const [ir] = a.recipe || dup ? [] : await db`select recipe from idea_recipes where household_id = ${hid} and name_key = ${nameKey(a.name)}`;
      const recipe = a.recipe ? capSteps(a.recipe) : (ir?.recipe ?? null);
      const [m] = dup ? [dup] : await db`
        insert into meals (household_id, name, tags, ingredients, stars, tried, obie, photo_url, recipe)
        values (${hid}, ${a.name}, ${db.json(a.tags)}, ${db.json(a.ingredients)}, ${a.stars ?? 0},
                ${a.tried ?? false}, ${a.obie ?? null}, ${a.photoUrl ?? null}, ${recipe ? db.json(recipe) : null})
        returning id`;
      if (a.addToWeek) {
        await db`insert into plan_items (household_id, meal_id) values (${hid}, ${m.id}) on conflict do nothing`;
      }
      break;
    }
    case "updateMeal": {
      if (!(await ownMeal(a.id))) break;
      if (a.name !== undefined) await db`update meals set name = ${a.name} where id = ${a.id}`;
      if (a.tags !== undefined) await db`update meals set tags = ${db.json(a.tags)} where id = ${a.id}`;
      if (a.ingredients !== undefined) await db`update meals set ingredients = ${db.json(a.ingredients)} where id = ${a.id}`;
      if (a.recipe !== undefined) await db`update meals set recipe = ${a.recipe ? db.json(capSteps(a.recipe)) : null} where id = ${a.id}`;
      if (a.stars !== undefined) await db`update meals set stars = ${a.stars}, tried = true where id = ${a.id}`;
      break;
    }
    case "removeMeal": {
      const [m] = await db`delete from meals where id = ${a.id} and household_id = ${hid} returning name`;
      if (m) {
        await db`insert into dismissed (household_id, name_key) values (${hid}, ${nameKey(m.name)}) on conflict do nothing`;
      }
      break;
    }
    case "dismissIdea":
      await db`insert into dismissed (household_id, name_key) values (${hid}, ${nameKey(a.name)}) on conflict do nothing`;
      break;
    case "toggleWeek": {
      if (!(await ownMeal(a.mealId))) break;
      const [existing] = await db`delete from plan_items where household_id = ${hid} and meal_id = ${a.mealId} returning meal_id`;
      if (!existing) await db`insert into plan_items (household_id, meal_id) values (${hid}, ${a.mealId})`;
      break;
    }
    case "setDay":
      await db`update plan_items set day = ${a.day} where household_id = ${hid} and meal_id = ${a.mealId}`;
      break;
    case "setMade":
      await db`update plan_items set made = ${a.made} where household_id = ${hid} and meal_id = ${a.mealId}`;
      if (a.made) await db`update meals set last_made = ${a.today} where id = ${a.mealId} and household_id = ${hid}`;
      break;
    case "startWeek":
      await db.begin(async (tx) => {
        await tx`update households set start_date = ${a.startDate} where id = ${hid}`;
        // Made meals leave the basket; anything not made carries over without a day.
        await tx`delete from plan_items where household_id = ${hid} and made = true`;
        await tx`update plan_items set day = null where household_id = ${hid}`;
        await tx`delete from shop_checks where household_id = ${hid}`;
        await tx`delete from shop_extras where household_id = ${hid}`;
      });
      break;
    case "toggleHave":
      if (a.got) {
        await db`insert into shop_checks (household_id, name_key) values (${hid}, ${nameKey(a.name)}) on conflict do nothing`;
      } else {
        await db`delete from shop_checks where household_id = ${hid} and name_key = ${nameKey(a.name)}`;
      }
      break;
    case "addExtra":
      await db`insert into shop_extras (household_id, name) values (${hid}, ${a.name})`;
      break;
    case "removeExtra":
      await db`delete from shop_extras where id = ${a.id} and household_id = ${hid}`;
      break;
    case "addCategory": {
      const [h] = await db`select categories from households where id = ${hid}`;
      const cats = normalizeCategories(h?.categories);
      if (!cats.some((c) => nameKey(c.name) === nameKey(a.name))) {
        const next: Category[] = [...cats, { name: a.name, description: a.description }];
        await db`update households set categories = ${db.json(next)} where id = ${hid}`;
      }
      break;
    }
    case "updateCategory": {
      const [h] = await db`select categories from households where id = ${hid}`;
      const next = normalizeCategories(h?.categories).map((c) => (c.name === a.name ? { ...c, description: a.description } : c));
      await db`update households set categories = ${db.json(next)} where id = ${hid}`;
      await db`delete from idea_cache where household_id = ${hid} and category = ${a.name}`;
      break;
    }
    case "setTastes":
      await db`update households set tastes = ${db.json(a.tastes)} where id = ${hid}`;
      // Old ideas were made without these tastes.
      if (!a.tastes.skipped) await db`delete from idea_cache where household_id = ${hid}`;
      break;
    case "removeCategory": {
      // Meals stay; they just lose this tag.
      await db.begin(async (tx) => {
        const [h] = await tx`select categories from households where id = ${hid} for update`;
        const next = normalizeCategories(h?.categories).filter((c) => c.name !== a.name);
        await tx`update households set categories = ${tx.json(next)} where id = ${hid}`;
        await tx`update meals set tags = tags - ${a.name}::text where household_id = ${hid} and tags ? ${a.name}`;
        await tx`delete from idea_cache where household_id = ${hid} and category = ${a.name}`;
      });
      break;
    }
  }

  const state = await loadState(hid);
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
}
