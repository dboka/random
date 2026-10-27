import { z } from "zod";
import { db, isAdmin, json, sameOrigin } from "@/lib/salon";

const create = z.discriminatedUnion("type", [
  z.object({ type: z.literal("staff"), name: z.string().trim().min(2).max(80) }),
  z.object({ type: z.literal("service"), name: z.string().trim().min(2).max(100), description: z.string().trim().max(300).default(""), durationMinutes: z.number().int().min(30).max(240).refine(v => v % 30 === 0), priceCents: z.number().int().min(0).max(100000).nullable(), staffIds: z.array(z.string().max(80)).min(1) }),
]);

export async function POST(request: Request) {
  if (!sameOrigin(request) || !(await isAdmin(request))) return json({ error: "Nav piekļuves." }, 401);
  const parsed = create.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Pārbaudiet ievadītos datus." }, 400);
  const input = parsed.data;
  const id = crypto.randomUUID();
  if (input.type === "staff") {
    await db().prepare("INSERT INTO staff (id,name,active) VALUES (?,?,1)").bind(id, input.name).run();
  } else {
    const validStaff = await db().prepare(`SELECT id FROM staff WHERE active=1 AND id IN (${input.staffIds.map(() => "?").join(",")})`).bind(...input.staffIds).all();
    if (validStaff.results.length !== new Set(input.staffIds).size) return json({ error: "Izvēlieties derīgus meistarus." }, 400);
    const database = db();
    await database.batch([
      database.prepare("INSERT INTO services (id,name,description,duration_minutes,price_cents,active,sort_order) VALUES (?,?,?,?,?,1,100)").bind(id, input.name, input.description, input.durationMinutes, input.priceCents),
      ...input.staffIds.map(staffId => database.prepare("INSERT INTO staff_services (staff_id,service_id) VALUES (?,?)").bind(staffId, id)),
    ]);
  }
  return json({ id }, 201);
}

const update = z.object({ type: z.enum(["staff", "service"]), id: z.string().min(1).max(80), active: z.boolean() });

export async function PATCH(request: Request) {
  if (!sameOrigin(request) || !(await isAdmin(request))) return json({ error: "Nav piekļuves." }, 401);
  const parsed = update.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Nederīgi dati." }, 400);
  const { type, id, active } = parsed.data;
  await db().prepare(`UPDATE ${type === "staff" ? "staff" : "services"} SET active=? WHERE id=?`).bind(active ? 1 : 0, id).run();
  return json({ ok: true });
}
