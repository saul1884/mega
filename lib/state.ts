import { normalizeCategories } from "@/lib/categories";
import { sql } from "./db";
import type { AppState, Meal } from "./types";

function isoDate(d: unknown): string | null {
  if (!d) return null;
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return String(d).slice(0, 10);
}

export async function loadState(hid: number): Promise<AppState | null> {
  const db = sql();
  const [h] = await db`select name, categories, tastes, start_date::text as start_date from households where id = ${hid}`;
  if (!h) return null;
  const [mealRows, planRows, checkRows, extraRows] = await Promise.all([
    db`select id, name, tags, ingredients, stars, tried, last_made::text as last_made, obie, photo_url, recipe
       from meals where household_id = ${hid} order by created_at`,
    db`select meal_id, day, made from plan_items where household_id = ${hid} order by added_at`,
    db`select name_key from shop_checks where household_id = ${hid}`,
    db`select id, name from shop_extras where household_id = ${hid} order by created_at`,
  ]);
  const meals: Meal[] = mealRows.map((r) => ({
    id: r.id,
    name: r.name,
    tags: r.tags ?? [],
    ingredients: r.ingredients ?? [],
    stars: r.stars,
    tried: r.tried,
    lastMade: isoDate(r.last_made),
    obie: r.obie ?? null,
    photoUrl: r.photo_url ?? null,
    recipe: r.recipe ?? null,
  }));
  return {
    household: h.name,
    categories: normalizeCategories(h.categories),
    tastes: h.tastes ?? null,
    meals,
    startDate: isoDate(h.start_date),
    plan: planRows.map((r) => ({ mealId: r.meal_id, day: r.day, made: r.made })),
    have: checkRows.map((r) => r.name_key),
    extras: extraRows.map((r) => ({ id: r.id, name: r.name })),
  };
}
