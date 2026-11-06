import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "mega_session";
const ONE_YEAR = 60 * 60 * 24 * 365;

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ characters)");
  return new TextEncoder().encode(s);
}

export async function setSession(householdId: number, remember = true): Promise<void> {
  const token = await new SignJWT({ hid: householdId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ONE_YEAR}s`)
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(remember ? { maxAge: ONE_YEAR } : {}),
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getHouseholdId(): Promise<number | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.hid === "number" ? payload.hid : null;
  } catch {
    return null;
  }
}
