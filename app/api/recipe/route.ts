import type { Tastes } from "@/lib/tastes";
import { normalizeCategories } from "@/lib/categories";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureSchema, sql } from "@/lib/db";
import { getHouseholdId } from "@/lib/auth";
import { writeRecipe } from "@/lib/ai";
import { loadState } from "@/lib/state";

export const maxDuration = 120;

const list = z.array(z.string().trim().min(1).max(120)).max(40);
const Body = z.union([
  // Write a recipe for a saved meal (AI ideas, or older meals) and store it.
  z.object({ mealId: z.string().uuid() }),
  // Tidy the household's own recipe text into steps. Not stored: the edit sheet saves it.
  z.object({ text: z.string().trim().min(10).max(6000), name: z.string().trim().max(120), tags: list, ingredients: list }),
]);

export async function POST(req: Request) {
  const hid = await getHouseholdId();
  if (!hid) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Add a bit more of the recipe first." }, { status: 400 });
  await ensureSchema();
  const db = sql();
  const [h] = await db`select categories, tastes from households where id = ${hid}`;
  const tastes = (h?.tastes ?? null) as Tastes | null;
  const kidsCats = new Set(normalizeCategories(h?.categories).filter((c) => c.kids).map((c) => c.name));

  try {
    if ("mealId" in parsed.data) {
      const [m] = await db`select id, name, tags, ingredients, recipe from meals where id = ${parsed.data.mealId} and household_id = ${hid}`;
      if (!m) return NextResponse.json({ error: "That meal has gone." }, { status: 404 });
      if (!m.recipe) {
        const tags: string[] = m.tags ?? [];
        const out = await writeRecipe({ name: m.name, ingredients: m.ingredients ?? [], tags, kids: tags.some((t) => kidsCats.has(t)), tastes });
        if (!out) throw new Error("No recipe came back");
        await db`update meals set recipe = ${db.json(out.recipe)} where id = ${m.id} and recipe is null`;
      }
      return NextResponse.json(await loadState(hid), { headers: { "Cache-Control": "no-store" } });
    }

    const { text, name, tags, ingredients } = parsed.data;
    const out = await writeRecipe({ name: name || "Their dish", ingredients, tags, kids: tags.some((t) => kidsCats.has(t)), tastes, text });
    if (!out) return NextResponse.json({ error: "Couldn't turn that into steps. Add a bit more detail and try again." }, { status: 422 });
    return NextResponse.json(out);
  } catch (e) {
    console.error("recipe failed", e);
    return NextResponse.json({ error: "Couldn't write the recipe right now. Try again in a moment." }, { status: 502 });
  }
}
