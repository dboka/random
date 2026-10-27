import { z } from "zod";
import { db, isAdmin, json, sameOrigin, sendSalonSms } from "@/lib/salon";

const schema = z.object({ id: z.string().uuid(), action: z.enum(["cancel", "retrySms"]) });

export async function PATCH(request: Request) {
  if (!sameOrigin(request) || !(await isAdmin(request))) return json({ error: "Nav piekļuves." }, 401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Nederīgi dati." }, 400);
  const { id, action } = parsed.data;
  const booking = await db().prepare("SELECT b.id,b.customer_name AS customerName,b.customer_phone AS customerPhone,b.date,b.time,b.status,s.name AS serviceName,t.name AS staffName FROM bookings b JOIN services s ON s.id=b.service_id JOIN staff t ON t.id=b.staff_id WHERE b.id=?")
    .bind(id).first<{ id: string; customerName: string; customerPhone: string; date: string; time: string; status: string; serviceName: string; staffName: string }>();
  if (!booking) return json({ error: "Pieraksts nav atrasts." }, 404);
  if (action === "cancel") {
    if (booking.status === "cancelled") return json({ ok: true });
    await db().batch([
      db().prepare("UPDATE bookings SET status='cancelled' WHERE id=?").bind(id),
      db().prepare("DELETE FROM slot_locks WHERE booking_id=?").bind(id),
    ]);
    return json({ ok: true });
  }
  if (booking.status !== "confirmed") return json({ error: "Atcelts pieraksts." }, 400);
  const smsStatus = await sendSalonSms(booking);
  await db().prepare("UPDATE bookings SET sms_status=? WHERE id=?").bind(smsStatus, id).run();
  return json({ ok: true, smsStatus });
}
