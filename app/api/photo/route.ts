import type { Tastes } from "@/lib/tastes";
import { normalizeCategories } from "@/lib/categories";
import { NextResponse } from "next/server";
import { z } from "zod";
import { put } from "@vercel/blob";
import { ensureSchema, sql } from "@/lib/db";
import { getHouseholdId } from "@/lib/auth";
import { readRecipePhoto } from "@/lib/ai";
import type { PhotoResult } from "@/lib/types";

export const maxDuration = 120;

const Body = z.object({
  // Client resizes to ~1600px JPEG first, so this stays well under Vercel's 4.5 MB body limit.
  dataUrl: z.string().max(4_000_000).regex(/^data:image\/(jpeg|png|webp);base64,/),
});

export async function POST(req: Request) {
  const hid = await getHouseholdId();
  if (!hid) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That image couldn't be read." }, { status: 400 });
  await ensureSchema();

  const [, mime, base64] = parsed.data.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.*)$/)!;
  const mediaType = mime as "image/jpeg" | "image/png" | "image/webp";
  const [h] = await sql()`select categories, tastes from households where id = ${hid}`;
  const categories = normalizeCategories(h?.categories);

  try {
    const [read, photoUrl] = await Promise.all([
      readRecipePhoto({ base64, mediaType, categories, tastes: (h?.tastes ?? null) as Tastes | null }),
      process.env.BLOB_READ_WRITE_TOKEN
        ? put(`recipes/${hid}/${Date.now()}.${mime.split("/")[1]}`, Buffer.from(base64, "base64"), {
            access: "public",
            contentType: mime,
            addRandomSuffix: true,
          }).then((b) => b.url)
        : Promise.resolve(null),
    ]);
    const result: PhotoResult = { ...read, photoUrl };
    return NextResponse.json(result);
  } catch (e) {
    console.error("photo failed", e);
    return NextResponse.json({ error: "Couldn't read that photo. Try again, or add the meal by hand." }, { status: 502 });
  }
}
