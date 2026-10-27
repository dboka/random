import { json, sameOrigin } from "@/lib/salon";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Nederīgs pieprasījums." }, 403);
  return Response.json({ ok: true }, { headers: { "Set-Cookie": "astorija_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0" } });
}
