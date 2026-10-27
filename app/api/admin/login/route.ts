import { adminCookie, json, rateLimit, runtime, sameOrigin, sha256 } from "@/lib/salon";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Nederīgs pieprasījums." }, 403);
  if (!(await rateLimit(request, "admin-login", 10, 3600))) return json({ error: "Pārāk daudz mēģinājumu." }, 429);
  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  if (!runtime.ADMIN_PASSWORD_HASH || !runtime.ADMIN_SESSION_SECRET || typeof body?.password !== "string") return json({ error: "Administratora piekļuve nav konfigurēta." }, 503);
  const hash = await sha256(body.password);
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ (runtime.ADMIN_PASSWORD_HASH[i]?.charCodeAt(0) || 0);
  if (diff !== 0 || runtime.ADMIN_PASSWORD_HASH.length !== hash.length) return json({ error: "Nepareiza parole." }, 401);
  return Response.json({ ok: true }, { headers: { "Set-Cookie": await adminCookie(), "Cache-Control": "no-store" } });
}
