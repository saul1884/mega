import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { DEFAULT_CATEGORIES, ensureSchema, nameKey, sql } from "@/lib/db";
import { clearSession, setSession } from "@/lib/auth";

const Body = z.object({
  mode: z.enum(["login", "signup", "logout"]),
  household: z.string().max(60).optional(),
  password: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { mode } = parsed.data;

  if (mode === "logout") {
    await clearSession();
    return NextResponse.json({ ok: true });
  }

  const household = (parsed.data.household ?? "").trim();
  const password = parsed.data.password ?? "";
  if (!household || !password) {
    return NextResponse.json({ error: "Enter your household name and password." }, { status: 400 });
  }

  await ensureSchema();
  const db = sql();
  const key = nameKey(household);

  if (mode === "signup") {
    if (password.length < 6) {
      return NextResponse.json({ error: "Use a password of at least 6 characters." }, { status: 400 });
    }
    const [existing] = await db`select id from households where name_key = ${key}`;
    if (existing) {
      return NextResponse.json({ error: "That household name is taken. Try logging in instead." }, { status: 409 });
    }
    const hash = await bcrypt.hash(password, 10);
    const [row] = await db`
      insert into households (name, name_key, password_hash, categories)
      values (${household}, ${key}, ${hash}, ${db.json(DEFAULT_CATEGORIES)})
      returning id`;
    await setSession(row.id);
    return NextResponse.json({ ok: true });
  }

  const [row] = await db`select id, password_hash from households where name_key = ${key}`;
  const ok = row ? await bcrypt.compare(password, row.password_hash) : false;
  if (!row) {
    return NextResponse.json({ error: "There's no household with that name yet. Tap “Set one up” below to create it." }, { status: 401 });
  }
  if (!ok) {
    return NextResponse.json({ error: "That household name and password don't match." }, { status: 401 });
  }
  await setSession(row.id);
  return NextResponse.json({ ok: true });
}
