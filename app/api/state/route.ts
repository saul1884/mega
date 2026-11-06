import { NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db";
import { getHouseholdId } from "@/lib/auth";
import { loadState } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function GET() {
  const hid = await getHouseholdId();
  if (!hid) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  await ensureSchema();
  const state = await loadState(hid);
  if (!state) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
}
