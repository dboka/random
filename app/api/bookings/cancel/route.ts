import { z } from "zod";
import { db, json, rateLimit, sameOrigin, sendSalonSms, sha256 } from "@/lib/salon";

const schema = z.object({ id: z.string().uuid(), token: z.string().length(64) });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Nederīgs pieprasījums." }, 403);
  if (!(await rateLimit(request, "cancel", 15, 3600))) return json({ error: "Pārāk daudz mēģinājumu." }, 429);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Nederīgs atcelšanas pieprasījums." }, 400);
  const booking = await db().prepare("SELECT b.id,b.cancel_token_hash AS tokenHash,b.status,b.customer_name AS customerName,b.customer_phone AS customerPhone,b.date,b.time,s.name AS serviceName,t.name AS staffName FROM bookings b JOIN services s ON s.id=b.service_id JOIN staff t ON t.id=b.staff_id WHERE b.id=?")
    .bind(parsed.data.id).first<{ id: string; tokenHash: string; status: string; customerName: string; customerPhone: string; date: string; time: string; serviceName: string; staffName: string }>();
  if (!booking || booking.tokenHash !== await sha256(parsed.data.token)) return json({ error: "Pieraksts nav atrasts." }, 404);
  if (booking.status === "cancelled") return json({ ok: true });
  await db().batch([
    db().prepare("UPDATE bookings SET status='cancelled' WHERE id=?").bind(parsed.data.id),
    db().prepare("DELETE FROM slot_locks WHERE booking_id=?").bind(parsed.data.id),
  ]);
  const smsStatus = await sendSalonSms(booking, "cancel");
  return json({ ok: true, smsStatus });
}
