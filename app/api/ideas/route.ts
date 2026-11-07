import { normalizeCategories } from "@/lib/categories";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureSchema, nameKey, sql } from "@/lib/db";
import { getHouseholdId } from "@/lib/auth";
import { categoryIdeas, moodIdeas } from "@/lib/ai";
import type { Idea } from "@/lib/types";

export const maxDuration = 120;

const Body = z.union([
  z.object({ category: z.string().min(1).max(60), refresh: z.boolean().optional() }),
  z.object({ mood: z.string().trim().min(1).max(200) }),
]);

export async function POST(req: Request) {
  const hid = await getHouseholdId();
  if (!hid) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  await ensureSchema();
  const db = sql();

  const [h] = await db`select categories from households where id = ${hid}`;
  const categories = normalizeCategories(h?.categories);
  const [meals, dismissed] = await Promise.all([
    db`select name from meals where household_id = ${hid}`,
    db`select name_key from dismissed where household_id = ${hid}`,
  ]);
  const taken = new Set<string>([...meals.map((m) => nameKey(m.name)), ...dismissed.map((d) => d.name_key)]);
  const avoidNames = [...meals.map((m) => m.name as string), ...dismissed.map((d) => d.name_key as string)];
  const fresh = (list: Idea[]) => list.filter((i) => !taken.has(nameKey(i.name)));

  try {
    if ("mood" in parsed.data) {
      const ideas = await moodIdeas({ mood: parsed.data.mood, categories, avoid: avoidNames });
      return NextResponse.json({ ideas: fresh(ideas) });
    }

    const { category, refresh } = parsed.data;
    if (!categories.some((c) => c.name === category)) return NextResponse.json({ error: "Unknown category" }, { status: 400 });

    const [cache] = await db`select ideas, seen from idea_cache where household_id = ${hid} and category = ${category}`;
    const cached: Idea[] = cache?.ideas ?? [];
    const seen: string[] = cache?.seen ?? [];
    if (cache && !refresh && fresh(cached).length > 0) {
      return NextResponse.json({ ideas: fresh(cached) });
    }

    const ideas = fresh(await categoryIdeas({ category, categories, avoid: [...avoidNames, ...seen] }));
    const newSeen = [...seen, ...cached.map((i) => i.name)].slice(-150);
    await db`
      insert into idea_cache (household_id, category, ideas, seen, updated_at)
      values (${hid}, ${category}, ${db.json(ideas)}, ${db.json(newSeen)}, now())
      on conflict (household_id, category)
      do update set ideas = excluded.ideas, seen = excluded.seen, updated_at = now()`;
    return NextResponse.json({ ideas });
  } catch (e) {
    console.error("ideas failed", e);
    return NextResponse.json({ error: "Couldn't get ideas right now. Try again in a moment." }, { status: 502 });
  }
}
